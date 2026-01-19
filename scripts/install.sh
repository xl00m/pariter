#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Запусти установщик от root (sudo bash)."
  exit 1
fi

read -rp "Домен (например: pariter.ru): " DOMAIN
read -rp "Email администратора: " ADMIN_EMAIL
read -rp "Логин администратора: " ADMIN_LOGIN
read -rsp "Пароль администратора (мин. 6): " ADMIN_PASS
echo

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" || -z "$ADMIN_LOGIN" || -z "$ADMIN_PASS" ]]; then
  echo "Все поля обязательны."
  exit 1
fi

echo
echo "Будет выполнена установка Pariter:"
echo "- Домен: $DOMAIN"
echo "- Email:  $ADMIN_EMAIL"
echo "- Логин:  $ADMIN_LOGIN"
read -rp "Продолжить? (y/N): " OK
if [[ "${OK,,}" != "y" ]]; then
  echo "Отменено."
  exit 0
fi

printf "\n[1/6] Обновляю apt…\n"
apt-get update -y

printf "\n[2/6] Устанавливаю зависимости…\n"
apt-get install -y curl ca-certificates unzip gnupg

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
# простая установка через git zip (без git)
TMP_ZIP="/tmp/pariter.zip"
curl -fsSL "https://github.com/xl00m/pariter/archive/refs/heads/main.zip" -o "$TMP_ZIP"
unzip -q -o "$TMP_ZIP" -d /tmp
rm -rf "$APP_DIR"/*
cp -R /tmp/pariter-main/* "$APP_DIR"/

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

# Caddy reverse proxy
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
  reverse_proxy 127.0.0.1:8080
}
EOF

# init admin
cd "$APP_DIR"
"${BUN_BIN}" run scripts/setup.ts

systemctl daemon-reload
systemctl enable --now pariter
systemctl restart caddy

printf "\nУспех! Открой: https://${DOMAIN}\n"
