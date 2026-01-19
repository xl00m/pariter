#!/usr/bin/env bash
set -euo pipefail

trap 'echo -e "\n[ERROR] Установка прервана (строка $LINENO)." >&2' ERR

# --- Helpers
log(){ printf "%b\n" "$*"; }
warn(){ printf "%b\n" "[WARN] $*" >&2; }
die(){ printf "%b\n" "[ERROR] $*" >&2; exit 1; }

have_cmd(){ command -v "$1" >/dev/null 2>&1; }

# When running via pipe (curl | sudo bash), stdin is not a TTY.
# Read all interactive input from /dev/tty.
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "Запусти установщик от root (sudo bash)."
fi
if [[ ! -r /dev/tty ]]; then
  die "Не найден /dev/tty для интерактивного ввода. Запусти установщик в интерактивном терминале."
fi

prompt(){
  local msg="$1"
  local silent="${2:-0}"
  local out=""
  if [[ "$silent" == "1" ]]; then
    IFS= read -r -s -p "$msg" out </dev/tty
    echo </dev/tty
  else
    IFS= read -r -p "$msg" out </dev/tty
  fi
  # Trim leading/trailing whitespace and control characters
  out="${out#"${out%%[![:space:]]*}"}"
  out="${out%"${out##*[![:space:]]}"}"
  # Remove any remaining newlines/carriage returns
  out="${out//$'\n'/}"
  out="${out//$'\r'/}"
  printf "%s" "$out"
}

port_busy(){
  local p="$1"
  ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "(:|\\])${p}\$"
}

pick_free_port(){
  local p
  for p in $(seq 8090 8105) $(seq 18080 18105); do
    if ! port_busy "$p"; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

ensure_user(){
  local u="$1"
  if id -u "$u" >/dev/null 2>&1; then
    return 0
  fi
  useradd -r -s /usr/sbin/nologin -d /opt/pariter "$u"
}

run_as_pariter(){
  if have_cmd runuser; then
    runuser -u pariter -- "$@"
  else
    su -s /bin/bash pariter -c "$(printf '%q ' "$@")"
  fi
}

nginx_domain_conflict(){
  local domain="$1"
  local files=()
  [[ -d /etc/nginx/sites-enabled ]] && files+=(/etc/nginx/sites-enabled)
  [[ -d /etc/nginx/conf.d ]] && files+=(/etc/nginx/conf.d)
  [[ ${#files[@]} -eq 0 ]] && return 1
  grep -R "server_name" "${files[@]}" 2>/dev/null | grep -q "\b${domain}\b"
}

write_nginx_vhost_http(){
  local vhost_path="$1"
  local domain="$2"
  local caddy_port="$3"

  cat > "$vhost_path" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${domain};

  client_max_body_size 25m;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
  }

  location / {
    proxy_pass http://127.0.0.1:${caddy_port};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
  }
}
EOF
}

write_nginx_vhost_https(){
  local vhost_path="$1"
  local domain="$2"
  local caddy_port="$3"
  local le_dir="$4"

  cat > "$vhost_path" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${domain};

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name ${domain};

  ssl_certificate     ${le_dir}/fullchain.pem;
  ssl_certificate_key ${le_dir}/privkey.pem;

  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:${caddy_port};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
  }
}
EOF
}

issue_cert_http_webroot(){
  local domain="$1"
  local email="$2"

  log "\n[HTTPS] Пытаюсь выпустить сертификат автоматически через HTTP-01 (webroot)."
  log "Если Let's Encrypt заблокирован или домен не указывает на сервер — попытка может не получиться."

  apt-get install -y certbot
  mkdir -p /var/www/letsencrypt

  if certbot certonly \
      --webroot \
      -w /var/www/letsencrypt \
      --agree-tos \
      --no-eff-email \
      -m "$email" \
      -d "$domain" </dev/tty; then
    return 0
  fi
  return 1
}

issue_cert_dns_manual(){
  local domain="$1"
  local email="$2"

  log "\n[HTTPS] Пытаюсь выпустить сертификат через DNS-01 (manual)."
  log "Тебе нужно будет добавить TXT запись _acme-challenge.${domain} в DNS панели домена."
  log "Важно: после добавления TXT записи подожди обновления DNS (иногда 1–10 минут)."
  log "Важно: сертификат через manual DNS-01 НЕ продляется автоматически.\n"

  prompt "Нажми Enter, чтобы запустить certbot (или Ctrl+C чтобы отменить)… " >/dev/null

  apt-get install -y certbot

  if certbot certonly \
      --manual \
      --preferred-challenges dns \
      --agree-tos \
      --no-eff-email \
      -m "$email" \
      -d "$domain" </dev/tty; then
    return 0
  fi
  return 1
}

# --- Inputs with validation
DOMAIN=""
ADMIN_EMAIL=""
ADMIN_LOGIN=""
ADMIN_PASS=""

while [[ -z "$DOMAIN" ]]; do
  DOMAIN="$(prompt "Домен (например: pariter.ru): ")"
  if [[ -z "$DOMAIN" ]]; then
    warn "Домен не может быть пустым."
  fi
done

while [[ -z "$ADMIN_EMAIL" ]]; do
  ADMIN_EMAIL="$(prompt "Email администратора: ")"
  if [[ -z "$ADMIN_EMAIL" ]]; then
    warn "Email не может быть пустым."
  fi
done

while [[ -z "$ADMIN_LOGIN" ]]; do
  ADMIN_LOGIN="$(prompt "Логин администратора: ")"
  if [[ -z "$ADMIN_LOGIN" ]]; then
    warn "Логин не может быть пустым."
  fi
done

while [[ -z "$ADMIN_PASS" || ${#ADMIN_PASS} -lt 6 ]]; do
  ADMIN_PASS="$(prompt "Пароль администратора (мин. 6 символов): " 1)"
  if [[ -z "$ADMIN_PASS" ]]; then
    warn "Пароль не может быть пустым."
  elif [[ ${#ADMIN_PASS} -lt 6 ]]; then
    warn "Пароль должен быть минимум 6 символов (введено: ${#ADMIN_PASS})."
  fi
done

log "\nБудет выполнена установка Pariter:"
log "- Домен: $DOMAIN"
log "- Email:  $ADMIN_EMAIL"
log "- Логин:  $ADMIN_LOGIN"
log "- Пароль: (скрыт, ${#ADMIN_PASS} символов)"
OK="$(prompt "Продолжить? (y/N): ")"
if [[ "${OK,,}" != "y" ]]; then
  log "Отменено."
  exit 0
fi

# --- Packages
log "\n[1/8] Обновляю apt…"
apt-get update -y

log "\n[2/8] Устанавливаю зависимости…"
apt-get install -y curl ca-certificates unzip gnupg iproute2

# --- Bun
log "\n[3/8] Устанавливаю Bun (если нужно)…"
if ! have_cmd bun; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="/root/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

BUN_BIN="$(command -v bun || true)"
if [[ -z "$BUN_BIN" ]]; then
  die "bun не найден в PATH после установки."
fi

if [[ "$BUN_BIN" == /root/* ]]; then
  install -m 0755 "$BUN_BIN" /usr/local/bin/bun
  BUN_BIN="/usr/local/bin/bun"
fi

# --- Caddy
log "\n[4/8] Устанавливаю Caddy (если нужно)…"
if ! have_cmd caddy; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

systemctl stop caddy 2>/dev/null || true

# --- App dir + user
log "\n[5/8] Создаю каталоги и системного пользователя…"
APP_DIR="/opt/pariter"
APP_PORT="8080"
mkdir -p "$APP_DIR"
ensure_user pariter

# --- Download repo
log "\n[6/8] Скачиваю репозиторий…"
TMP_ZIP="/tmp/pariter.zip"
EXTRACT_DIR="$(mktemp -d)"

if curl -fsSL "https://github.com/xl00m/pariter/archive/refs/heads/main.zip" -o "$TMP_ZIP"; then
  :
else
  warn "Не удалось скачать архив с GitHub."
  TOKEN="$(prompt "GitHub token (PAT) для private repo (Enter — пропустить): " 1)"
  if [[ -z "$TOKEN" ]]; then
    die "Скачивание прервано."
  fi
  if ! curl -fsSL \
        -H "Authorization: token $TOKEN" \
        -H "User-Agent: pariter-installer" \
        "https://api.github.com/repos/xl00m/pariter/zipball/main" \
        -o "$TMP_ZIP"; then
    die "Не удалось скачать репозиторий."
  fi
fi

unzip -q -o "$TMP_ZIP" -d "$EXTRACT_DIR"
SRC_DIR="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[[ -z "$SRC_DIR" ]] && die "Не удалось найти распакованный каталог Pariter."

rm -rf "$APP_DIR"/*
cp -R "$SRC_DIR"/* "$APP_DIR"/
rm -f "$TMP_ZIP"
rm -rf "$EXTRACT_DIR"

# --- Config (safe JSON)
json_escape(){
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  s=${s//$'\b'/\\b}
  s=${s//$'\f'/\\f}
  printf "%s" "$s"
}

DOMAIN_J="$(json_escape "$DOMAIN")"
ADMIN_EMAIL_J="$(json_escape "$ADMIN_EMAIL")"
ADMIN_LOGIN_J="$(json_escape "$ADMIN_LOGIN")"
ADMIN_PASS_J="$(json_escape "$ADMIN_PASS")"

cat > "$APP_DIR/config.json" <<EOF
{
  "domain": "${DOMAIN_J}",
  "adminEmail": "${ADMIN_EMAIL_J}",
  "adminName": "Admin",
  "adminLogin": "${ADMIN_LOGIN_J}",
  "adminPassword": "${ADMIN_PASS_J}",
  "adminRole": "warrior",
  "adminTheme": "dark_warrior",
  "port": ${APP_PORT},
  "dbPath": "${APP_DIR}/pariter.db",
  "staticDir": "${APP_DIR}/static"
}
EOF

# Validate JSON with detailed diagnostics
log "Проверяю config.json…"
if ! "$BUN_BIN" -e "
  const fs = require('fs');
  try {
    const content = fs.readFileSync(process.argv[1], 'utf8');
    JSON.parse(content);
    process.exit(0);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    console.error('--- File contents ---');
    console.error(fs.readFileSync(process.argv[1], 'utf8'));
    console.error('--- End of file ---');
    process.exit(1);
  }
" "$APP_DIR/config.json"; then
  die "config.json повреждён. См. вывод выше."
fi

log "config.json валиден."
chown -R pariter:pariter "$APP_DIR"

# --- systemd
log "\n[7/8] Настраиваю systemd…"
cat > /etc/systemd/system/pariter.service <<EOF
[Unit]
Description=Pariter (Bun + SQLite)
After=network.target

[Service]
Type=simple
User=pariter
Group=pariter
WorkingDirectory=${APP_DIR}
Environment=PORT=${APP_PORT}
Environment=PARITER_DB=${APP_DIR}/pariter.db
Environment=PARITER_STATIC=${APP_DIR}/static
Environment=PARITER_SECURE_COOKIE=1
ExecStart=${BUN_BIN} run src/index.ts
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF

# Backup timer
mkdir -p "$APP_DIR/backups"
cat > /usr/local/bin/pariter-backup.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/opt/pariter"
BK_DIR="${APP_DIR}/backups"
mkdir -p "$BK_DIR"
TS="$(date +%F)"
SRC="${APP_DIR}/pariter.db"
DST="${BK_DIR}/pariter-${TS}.db"
if [[ -f "$SRC" ]]; then
  cp "$SRC" "$DST"
  gzip -f "$DST"
fi
find "$BK_DIR" -type f -name 'pariter-*.db.gz' -mtime +14 -delete 2>/dev/null || true
EOF
chmod 0755 /usr/local/bin/pariter-backup.sh

cat > /etc/systemd/system/pariter-backup.service <<'EOF'
[Unit]
Description=Pariter DB backup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/pariter-backup.sh
EOF

cat > /etc/systemd/system/pariter-backup.timer <<'EOF'
[Unit]
Description=Daily Pariter backup

[Timer]
OnCalendar=*-*-* 03:17:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# --- Reverse proxy
log "\n[8/8] Настраиваю reverse-proxy и запускаю…"

NGINX_ACTIVE=0
if systemctl is-active --quiet nginx 2>/dev/null; then
  NGINX_ACTIVE=1
fi

PORT80_BUSY=0
PORT443_BUSY=0
port_busy 80 && PORT80_BUSY=1
port_busy 443 && PORT443_BUSY=1

NGINX_MODE=0
if [[ "$NGINX_ACTIVE" -eq 1 && ( "$PORT80_BUSY" -eq 1 || "$PORT443_BUSY" -eq 1 ) ]]; then
  NGINX_MODE=1
fi

CUSTOM_PROXY_NEEDED=0
if [[ "$NGINX_MODE" -eq 0 && ( "$PORT80_BUSY" -eq 1 || "$PORT443_BUSY" -eq 1 ) ]]; then
  CUSTOM_PROXY_NEEDED=1
  warn "Порты 80/443 заняты, но nginx не активен."
  warn "Pariter будет поднят, прокси/HTTPS нужно настроить вручную."
fi

mkdir -p /etc/caddy

CADDY_PORT=""
LE_DIR="/etc/letsencrypt/live/${DOMAIN}"
HAS_LE_CERT=0
[[ -f "$LE_DIR/fullchain.pem" && -f "$LE_DIR/privkey.pem" ]] && HAS_LE_CERT=1

NGINX_CONFLICT=0
if [[ "$NGINX_MODE" -eq 1 ]]; then
  if nginx_domain_conflict "$DOMAIN"; then
    NGINX_CONFLICT=1
    warn "В nginx уже есть конфиг с server_name ${DOMAIN}."
  fi

  CADDY_PORT="$(pick_free_port || true)"
  [[ -z "$CADDY_PORT" ]] && die "Не удалось подобрать свободный порт для Caddy."

  cat > /etc/caddy/Caddyfile <<EOF
http://127.0.0.1:${CADDY_PORT} {
  reverse_proxy 127.0.0.1:${APP_PORT}
}
EOF

  if [[ "$NGINX_CONFLICT" -eq 0 ]]; then
    NGINX_VHOST=""
    if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
      NGINX_VHOST="/etc/nginx/sites-available/pariter-${DOMAIN}.conf"
    else
      NGINX_VHOST="/etc/nginx/conf.d/pariter-${DOMAIN}.conf"
    fi

    if [[ "$HAS_LE_CERT" -eq 1 ]]; then
      write_nginx_vhost_https "$NGINX_VHOST" "$DOMAIN" "$CADDY_PORT" "$LE_DIR"
      sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service
    else
      write_nginx_vhost_http "$NGINX_VHOST" "$DOMAIN" "$CADDY_PORT"
      sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=0/' /etc/systemd/system/pariter.service

      if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
        ln -sf "$NGINX_VHOST" "/etc/nginx/sites-enabled/pariter-${DOMAIN}.conf"
      fi
      mkdir -p /var/www/letsencrypt

      if nginx -t 2>/dev/null; then
        systemctl reload nginx || systemctl restart nginx

        if issue_cert_http_webroot "$DOMAIN" "$ADMIN_EMAIL"; then
          HAS_LE_CERT=0
          [[ -f "$LE_DIR/fullchain.pem" && -f "$LE_DIR/privkey.pem" ]] && HAS_LE_CERT=1
          if [[ "$HAS_LE_CERT" -eq 1 ]]; then
            write_nginx_vhost_https "$NGINX_VHOST" "$DOMAIN" "$CADDY_PORT" "$LE_DIR"
            sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service
            log "[HTTPS] Сертификат выпущен через HTTP-01."
            nginx -t && systemctl reload nginx
          fi
        else
          warn "Не удалось выпустить сертификат через HTTP-01."

          CHOICE="$(prompt "\nПопробовать выпуск через DNS-01 (manual)? (y/N): ")"
          if [[ "${CHOICE,,}" == "y" ]]; then
            success=0
            for attempt in 1 2; do
              if issue_cert_dns_manual "$DOMAIN" "$ADMIN_EMAIL"; then
                success=1
                break
              fi
              warn "Не удалось выпустить сертификат (попытка ${attempt}/2)."
              if [[ "$attempt" -lt 2 ]]; then
                AGAIN="$(prompt "Повторить? (y/N): ")"
                [[ "${AGAIN,,}" != "y" ]] && break
              fi
            done

            if [[ "$success" -eq 1 ]]; then
              HAS_LE_CERT=0
              [[ -f "$LE_DIR/fullchain.pem" && -f "$LE_DIR/privkey.pem" ]] && HAS_LE_CERT=1
              if [[ "$HAS_LE_CERT" -eq 1 ]]; then
                write_nginx_vhost_https "$NGINX_VHOST" "$DOMAIN" "$CADDY_PORT" "$LE_DIR"
                sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service
                log "[HTTPS] Сертификат выпущен через DNS-01."
                nginx -t && systemctl reload nginx
              fi
            fi
          fi
        fi
      else
        warn "nginx -t не прошёл. Сертификат не выпущен."
      fi
    fi

    if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
      ln -sf "$NGINX_VHOST" "/etc/nginx/sites-enabled/pariter-${DOMAIN}.conf"
    fi

    if nginx -t 2>/dev/null; then
      systemctl reload nginx || systemctl restart nginx
    else
      warn "nginx -t не прошёл. Проверь конфиг вручную: ${NGINX_VHOST}"
    fi
  else
    warn "NGINX_CONFLICT=1: nginx vhost не создан."
    warn "Настрой proxy_pass для ${DOMAIN} -> http://127.0.0.1:${CADDY_PORT}"
  fi

elif [[ "$CUSTOM_PROXY_NEEDED" -eq 1 ]]; then
  CADDY_PORT="$(pick_free_port || true)"
  [[ -z "$CADDY_PORT" ]] && die "Не удалось подобрать порт для Caddy."
  cat > /etc/caddy/Caddyfile <<EOF
http://127.0.0.1:${CADDY_PORT} {
  reverse_proxy 127.0.0.1:${APP_PORT}
}
EOF
  sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=0/' /etc/systemd/system/pariter.service

else
  cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
  reverse_proxy 127.0.0.1:${APP_PORT}
}
EOF
  sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service
fi

# --- Init DB + admin
cd "$APP_DIR"
run_as_pariter "$BUN_BIN" install --no-save >/dev/null 2>&1 || true
run_as_pariter "$BUN_BIN" run scripts/setup.ts

# --- Start services
systemctl daemon-reload
systemctl enable --now pariter
systemctl restart pariter

systemctl enable --now pariter-backup.timer
systemctl start pariter-backup.timer 2>/dev/null || true

systemctl restart caddy

# Health check
sleep 2
if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
  log "\n[OK] Pariter отвечает на http://127.0.0.1:${APP_PORT}"
else
  warn "Pariter не отвечает. Проверь: journalctl -u pariter -n 80 --no-pager"
fi

# --- Final message
if [[ "$NGINX_MODE" -eq 1 ]]; then
  if [[ "$NGINX_CONFLICT" -eq 1 ]]; then
    log "\nГотово. Caddy: 127.0.0.1:${CADDY_PORT}. Настрой nginx вручную."
  elif [[ "$HAS_LE_CERT" -eq 1 ]]; then
    log "\nГотово. nginx(HTTPS) -> Caddy -> Pariter"
    log "Открой: https://${DOMAIN}"
  else
    log "\nГотово. nginx(HTTP) -> Caddy -> Pariter"
    log "Открой: http://${DOMAIN}"
    log "\nДля HTTPS:"
    log "  sudo sed -i 's/PARITER_SECURE_COOKIE=0/PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service"
    log "  sudo systemctl daemon-reload && sudo systemctl restart pariter"
  fi
elif [[ "$CUSTOM_PROXY_NEEDED" -eq 1 ]]; then
  log "\nГотово. Caddy: 127.0.0.1:${CADDY_PORT}. Настрой reverse proxy вручную."
else
  log "\nУспех! Открой: https://${DOMAIN}"
fi

log "\nБэкапы: ${APP_DIR}/backups (14 дней, ежедневно 03:17)"
log "\nЛоги:"
log "  sudo journalctl -u pariter -f"
log "  sudo journalctl -u caddy -f"
[[ "$NGINX_MODE" -eq 1 ]] && log "  sudo journalctl -u nginx -f"