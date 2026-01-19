#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Запусти установщик от root (sudo bash)."
  exit 1
fi

# When running via pipe (curl | sudo bash), stdin is not a TTY.
# Read all interactive input from /dev/tty.
if [[ ! -r /dev/tty ]]; then
  echo "Не найден /dev/tty для интерактивного ввода. Запусти установщик в интерактивном терминале." >&2
  exit 1
fi

prompt(){
  local msg="$1"
  local silent="${2:-0}"
  local out=""
  if [[ "$silent" == "1" ]]; then
    IFS= read -r -s -p "$msg" out </dev/tty
    # newline after silent input
    echo </dev/tty
  else
    IFS= read -r -p "$msg" out </dev/tty
  fi
  printf "%s" "$out"
}

DOMAIN="$(prompt "Домен (например: pariter.ru): ")"
ADMIN_EMAIL="$(prompt "Email администратора: ")"
ADMIN_LOGIN="$(prompt "Логин администратора: ")"
ADMIN_PASS="$(prompt "Пароль администратора (мин. 6): " 1)"

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" || -z "$ADMIN_LOGIN" || -z "$ADMIN_PASS" ]]; then
  echo "Все поля обязательны."
  exit 1
fi

echo
echo "Будет выполнена установка Pariter:"
echo "- Домен: $DOMAIN"
echo "- Email:  $ADMIN_EMAIL"
echo "- Логин:  $ADMIN_LOGIN"
OK="$(prompt "Продолжить? (y/N): ")"
if [[ "${OK,,}" != "y" ]]; then
  echo "Отменено."
  exit 0
fi

printf "\n[1/6] Обновляю apt…\n"
apt-get update -y

printf "\n[2/6] Устанавливаю зависимости…\n"
apt-get install -y curl ca-certificates unzip gnupg iproute2

printf "\n[3/6] Устанавливаю Bun (если нужно)…\n"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="/root/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

printf "\n[4/6] Устанавливаю Caddy (если нужно)…\n"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

APP_DIR="/opt/pariter"
mkdir -p "$APP_DIR"

printf "\n[5/6] Скачиваю репозиторий…\n"
TMP_ZIP="/tmp/pariter.zip"
EXTRACT_DIR="$(mktemp -d)"

# Простой способ: архив ветки main
curl -fsSL "https://github.com/xl00m/pariter/archive/refs/heads/main.zip" -o "$TMP_ZIP"

unzip -q -o "$TMP_ZIP" -d "$EXTRACT_DIR"
SRC_DIR="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "$SRC_DIR" ]]; then
  echo "Не удалось найти распакованный каталог Pariter."
  exit 1
fi

rm -rf "$APP_DIR"/*
cp -R "$SRC_DIR"/* "$APP_DIR"/

rm -f "$TMP_ZIP"
rm -rf "$EXTRACT_DIR"

cat > "$APP_DIR/config.json" <<EOF
{
  "domain": "${DOMAIN}",
  "adminEmail": "${ADMIN_EMAIL}",
  "adminName": "Admin",
  "adminLogin": "${ADMIN_LOGIN}",
  "adminPassword": "${ADMIN_PASS}",
  "adminRole": "warrior",
  "adminTheme": "dark_warrior",
  "port": 8080,
  "dbPath": "${APP_DIR}/pariter.db",
  "staticDir": "${APP_DIR}/static"
}
EOF

printf "\n[6/6] Настраиваю systemd + Caddy + setup…\n"
BUN_BIN="$(command -v bun)"
if [[ -z "$BUN_BIN" ]]; then
  echo "bun не найден в PATH после установки."
  exit 1
fi

# Detect if nginx already occupies standard ports.
NGINX_ACTIVE=0
if systemctl is-active --quiet nginx 2>/dev/null; then
  NGINX_ACTIVE=1
fi

PORT80_BUSY=0
PORT443_BUSY=0
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ':(80)$'; then PORT80_BUSY=1; fi
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ':(443)$'; then PORT443_BUSY=1; fi

# We only switch to nginx->caddy mode when nginx is active AND it actually listens on :80 or :443.
if [[ "$NGINX_ACTIVE" -eq 1 && "$PORT80_BUSY" -eq 0 && "$PORT443_BUSY" -eq 0 ]]; then
  NGINX_ACTIVE=0
fi

# Pick a free port for Caddy when nginx is on 80/443.
CADDY_PORT=""
if [[ "$NGINX_ACTIVE" -eq 1 && ( "$PORT80_BUSY" -eq 1 || "$PORT443_BUSY" -eq 1 ) ]]; then
  for p in 8090 8091 8092 8093 8094 8095 18080 18081; do
    if ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":(${p})$"; then
      CADDY_PORT="$p"
      break
    fi
  done
  if [[ -z "$CADDY_PORT" ]]; then
    echo "Не удалось подобрать свободный порт для Caddy."
    exit 1
  fi
else
  CADDY_PORT=""
fi

cat > /etc/systemd/system/pariter.service <<EOF
[Unit]
Description=Pariter (Bun + SQLite)
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
Environment=PORT=8080
Environment=PARITER_DB=${APP_DIR}/pariter.db
Environment=PARITER_STATIC=${APP_DIR}/static
Environment=PARITER_SECURE_COOKIE=1
ExecStart=${BUN_BIN} run src/index.ts
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Caddy config:
# - If nginx is already handling :80/:443, run Caddy on a free port and let nginx proxy to it.
# - Otherwise, let Caddy handle :80/:443 directly (auto-HTTPS).
if [[ -n "$CADDY_PORT" ]]; then
  mkdir -p /etc/caddy
  cat > /etc/caddy/Caddyfile <<EOF
http://127.0.0.1:${CADDY_PORT} {
  reverse_proxy 127.0.0.1:8080
}
EOF

  # nginx vhost for the domain -> proxy to Caddy
  if [[ -d /etc/nginx/sites-available ]]; then
    cat > /etc/nginx/sites-available/pariter-${DOMAIN}.conf <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:${CADDY_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF

    ln -sf /etc/nginx/sites-available/pariter-${DOMAIN}.conf /etc/nginx/sites-enabled/pariter-${DOMAIN}.conf
  else
    # fallback: drop-in config
    cat > /etc/nginx/conf.d/pariter-${DOMAIN}.conf <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:${CADDY_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF
  fi

  # Reload nginx if present.
  systemctl reload nginx || systemctl restart nginx || true
else
  cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
  reverse_proxy 127.0.0.1:8080
}
EOF
fi

# init admin
cd "$APP_DIR"
"${BUN_BIN}" run scripts/setup.ts

systemctl daemon-reload
systemctl enable --now pariter
systemctl restart caddy

if [[ -n "$CADDY_PORT" ]]; then
  printf "\nГотово. nginx проксирует ${DOMAIN} -> Caddy(127.0.0.1:${CADDY_PORT}) -> Pariter(127.0.0.1:8080)\n"
  printf "Открой: http://${DOMAIN} (HTTPS остаётся за nginx, если он уже настроен)\n"
else
  printf "\nУспех! Открой: https://${DOMAIN}\n"
fi
