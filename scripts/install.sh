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

  # Trim leading/trailing whitespace
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

port_busy_by_nginx(){
  local p="$1"
  # Needs ss with process info; returns true if nginx is the listener on this port.
  ss -ltnpH 2>/dev/null | grep -E "(:|\\])${p}\\b" | grep -q '"nginx"'
}

pick_free_port(){
  # Prefer a small known range to avoid firewall surprises.
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
  # Run a command as the pariter system user.
  if have_cmd runuser; then
    runuser -u pariter -- "$@"
  else
    su -s /bin/bash pariter -c "$(printf '%q ' "$@")"
  fi
}

nginx_domain_conflict(){
  local domain="$1"
  # Avoid grep errors if dirs don't exist
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

  # ACME HTTP-01 challenge (certbot --webroot)
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

  # ACME HTTP-01 challenge (certbot --webroot)
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

  # certbot can be interactive (first run); ensure it reads from /dev/tty.
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
  log "Важно: после добавления TXT записи подожди обновления DNS (иногда 1–10 минут, зависит от TTL)."
  log "Важно: сертификат через manual DNS-01 НЕ продляется автоматически — раз в ~90 дней потребуется повторить выпуск или настроить DNS-плагин."
  log "Если DNS-панель не у тебя — пропусти шаг и настрой HTTPS позже.\n"

  # Extra pause so user clearly sees what will happen next.
  prompt "Нажми Enter, чтобы запустить certbot (или Ctrl+C чтобы отменить выпуск сертификата и остаться на HTTP)… " >/dev/null

  apt-get install -y certbot

  # Certbot is interactive in manual DNS mode. When running via pipe (curl | bash),
  # stdin is not a TTY, so certbot may immediately continue (EOF) and fail.
  # Force stdin to /dev/tty so it truly waits for Enter.
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

# --- Early update mode (do not ask install questions)
APP_DIR_DEFAULT="/opt/pariter"
if [[ -d "$APP_DIR_DEFAULT" && -f "$APP_DIR_DEFAULT/config.json" && -f /etc/systemd/system/pariter.service ]]; then
  log "\n[INFO] Найдена установленная версия Pariter в ${APP_DIR_DEFAULT}."
  UPD="$(prompt "Обновить до последней версии? (Y/n): ")"
  if [[ "${UPD,,}" != "n" ]]; then
    log "\n[UPDATE] Обновляю код, сохраняя текущие config.json и БД…"

    # Requirements (should already exist, but keep safe)
    apt-get update -y >/dev/null 2>&1 || true
    apt-get install -y curl ca-certificates unzip >/dev/null 2>&1 || true

    BUN_BIN="$(command -v bun || true)"
    if [[ -z "$BUN_BIN" ]]; then
      die "bun не найден. Для обновления нужен bun в PATH."
    fi

    # Ensure system user exists (for chown consistency)
    ensure_user pariter

    # Download repo (non-interactive). For private repo, use env token.
    TMP_ZIP="/tmp/pariter-update.zip"
    EXTRACT_DIR="$(mktemp -d)"

    if ! curl -fsSL "https://github.com/xl00m/pariter/archive/refs/heads/main.zip" -o "$TMP_ZIP"; then
      TOKEN_ENV="${PARITER_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"
      if [[ -z "$TOKEN_ENV" ]]; then
        die "Не удалось скачать обновление (возможно private repo). Задай PARITER_GITHUB_TOKEN или GITHUB_TOKEN и повтори."
      fi
      if ! curl -fsSL \
            -H "Authorization: token $TOKEN_ENV" \
            -H "User-Agent: pariter-installer" \
            "https://api.github.com/repos/xl00m/pariter/zipball/main" \
            -o "$TMP_ZIP"; then
        die "Не удалось скачать обновление даже с token."
      fi
    fi

    unzip -q -o "$TMP_ZIP" -d "$EXTRACT_DIR"
    SRC_DIR="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
    [[ -z "$SRC_DIR" ]] && die "Не удалось найти распакованный каталог обновления."

    PRESERVE_DIR="$(mktemp -d)"
    cp -f "$APP_DIR_DEFAULT/config.json" "$PRESERVE_DIR/" 2>/dev/null || true
    cp -f "$APP_DIR_DEFAULT/pariter.db" "$PRESERVE_DIR/" 2>/dev/null || true
    cp -f "$APP_DIR_DEFAULT/pariter.db-wal" "$PRESERVE_DIR/" 2>/dev/null || true
    cp -f "$APP_DIR_DEFAULT/pariter.db-shm" "$PRESERVE_DIR/" 2>/dev/null || true
    cp -f "$APP_DIR_DEFAULT/.env" "$PRESERVE_DIR/" 2>/dev/null || true
    if [[ -d "$APP_DIR_DEFAULT/backups" ]]; then
      mv "$APP_DIR_DEFAULT/backups" "$PRESERVE_DIR/backups" 2>/dev/null || true
    fi

    systemctl stop pariter 2>/dev/null || true

    rm -rf "$APP_DIR_DEFAULT"/*
    cp -R "$SRC_DIR"/* "$APP_DIR_DEFAULT"/

    # restore preserved data
    if [[ -f "$PRESERVE_DIR/config.json" ]]; then
      cp -f "$PRESERVE_DIR/config.json" "$APP_DIR_DEFAULT/config.json"
    fi
    if [[ -f "$PRESERVE_DIR/pariter.db" ]]; then
      cp -f "$PRESERVE_DIR/pariter.db" "$APP_DIR_DEFAULT/pariter.db"
    fi
    [[ -f "$PRESERVE_DIR/pariter.db-wal" ]] && cp -f "$PRESERVE_DIR/pariter.db-wal" "$APP_DIR_DEFAULT/pariter.db-wal" || true
    [[ -f "$PRESERVE_DIR/pariter.db-shm" ]] && cp -f "$PRESERVE_DIR/pariter.db-shm" "$APP_DIR_DEFAULT/pariter.db-shm" || true
    if [[ -f "$PRESERVE_DIR/.env" ]]; then
      cp -f "$PRESERVE_DIR/.env" "$APP_DIR_DEFAULT/.env"
    fi

    if [[ -d "$PRESERVE_DIR/backups" ]]; then
      mv "$PRESERVE_DIR/backups" "$APP_DIR_DEFAULT/backups" 2>/dev/null || true
    else
      mkdir -p "$APP_DIR_DEFAULT/backups" 2>/dev/null || true
    fi

    rm -f "$TMP_ZIP"
    rm -rf "$EXTRACT_DIR" "$PRESERVE_DIR"

    chown -R pariter:pariter "$APP_DIR_DEFAULT" 2>/dev/null || true

    systemctl daemon-reload
    systemctl start pariter
    systemctl restart pariter

    log "\n[OK] Обновление завершено."
    log "Логи: sudo journalctl -u pariter -n 120 --no-pager"
    exit 0
  fi
fi

# --- Inputs
DOMAIN="$(prompt "Домен (например: pariter.ru): ")"
ADMIN_EMAIL="$(prompt "Email администратора: ")"
ADMIN_LOGIN="$(prompt "Логин администратора: ")"
ADMIN_PASS="$(prompt "Пароль администратора (мин. 6): " 1)"

# Normalize domain: strip protocol/slashes/spaces and drop leading www.
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%%/*}"
DOMAIN="${DOMAIN,,}"
if [[ "$DOMAIN" == www.* ]]; then
  DOMAIN="${DOMAIN#www.}"
fi

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" || -z "$ADMIN_LOGIN" || -z "$ADMIN_PASS" ]]; then
  die "Все поля обязательны."
fi

log "\nБудет выполнена установка Pariter:" 
log "- Домен: $DOMAIN"
log "- Email:  $ADMIN_EMAIL"
log "- Логин:  $ADMIN_LOGIN"
OK="$(prompt "Продолжить? (y/N): ")"
if [[ "${OK,,}" != "y" ]]; then
  log "Отменено."
  exit 0
fi

# --- Packages
log "\n[1/8] Обновляю apt…"
apt-get update -y

log "\n[2/8] Устанавливаю зависимости…"
# iproute2 -> ss
apt-get install -y curl ca-certificates unzip gnupg iproute2

# --- Firewall (UFW)
# A very common reason for ACME timeouts on a clean VPS is UFW blocking 80/443.
if have_cmd ufw; then
  if ufw status 2>/dev/null | grep -q -i "Status: active"; then
    log "\n[FW] UFW активен — открываю порты 80/tcp и 443/tcp…"
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi
fi

# --- DNS sanity check (prevents broken ACME / wrong IP situations)
PUBLIC_IP="$(curl -fsS https://api.ipify.org || true)"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)"
PUBLIC_IP6="$(curl -fsS https://api64.ipify.org || true)"
DOMAIN_IP6="$(getent ahostsv6 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)"

# Detect if www.<domain> has DNS (only then we can safely add www->apex redirect without breaking ACME).
WWW_DOMAIN="www.${DOMAIN}"
WWW_HAS_DNS=0
if getent ahostsv4 "$WWW_DOMAIN" >/dev/null 2>&1 || getent ahostsv6 "$WWW_DOMAIN" >/dev/null 2>&1; then
  WWW_HAS_DNS=1
fi

if [[ -n "$PUBLIC_IP" && -n "$DOMAIN_IP" && "$PUBLIC_IP" != "$DOMAIN_IP" ]]; then
  warn "DNS A: ${DOMAIN} -> ${DOMAIN_IP}, но внешний IPv4 сервера: ${PUBLIC_IP}."
  warn "Это частая причина пустой страницы и провала выпуска сертификата."
  CONT="$(prompt "Продолжить установку всё равно? (y/N): ")"
  if [[ "${CONT,,}" != "y" ]]; then
    die "Остановлено. Исправь DNS A-запись и запусти установку снова."
  fi
elif [[ -z "$DOMAIN_IP" ]]; then
  warn "Не удалось получить A-запись (IPv4) для домена ${DOMAIN}."
fi

# IPv6 is a very common ACME pitfall: if AAAA points elsewhere, Let's Encrypt will try IPv6 and fail.
if [[ -n "$DOMAIN_IP6" && -n "$PUBLIC_IP6" && "$DOMAIN_IP6" != "$PUBLIC_IP6" ]]; then
  warn "DNS AAAA: ${DOMAIN} -> ${DOMAIN_IP6}, но внешний IPv6 сервера: ${PUBLIC_IP6}."
  warn "Если AAAA указывает не на этот сервер — ACME/HTTPS часто будет падать."
  CONT6="$(prompt "Продолжить установку всё равно? (y/N): ")"
  if [[ "${CONT6,,}" != "y" ]]; then
    die "Остановлено. Исправь DNS AAAA-запись (или удали AAAA) и запусти установку снова."
  fi
fi

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

# If bun is under /root, make it accessible for systemd non-root service.
# /root is usually 0700, so we copy bun to /usr/local/bin.
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

# Caddy package sometimes tries to start immediately.
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
  warn "Не удалось скачать архив с GitHub (возможна приватность репозитория или блокировки)."
  TOKEN="$(prompt "GitHub token (PAT) для скачивания private repo (Enter — пропустить): " 1)"
  if [[ -z "$TOKEN" ]]; then
    die "Скачивание прервано. Репозиторий недоступен без доступа."
  fi
  if ! curl -fsSL \
        -H "Authorization: token $TOKEN" \
        -H "User-Agent: pariter-installer" \
        "https://api.github.com/repos/xl00m/pariter/zipball/main" \
        -o "$TMP_ZIP"; then
    die "Не удалось скачать репозиторий даже с token."
  fi
fi

unzip -q -o "$TMP_ZIP" -d "$EXTRACT_DIR"
SRC_DIR="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[[ -z "$SRC_DIR" ]] && die "Не удалось найти распакованный каталог Pariter."

rm -rf "$APP_DIR"/*
cp -R "$SRC_DIR"/* "$APP_DIR"/
rm -f "$TMP_ZIP"
rm -rf "$EXTRACT_DIR"

# Config (safe JSON)
json_escape(){
  # Minimal JSON string escaping (enough for our config fields)
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//"/\\"}
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

# .env (AI key). Create only if missing; keep user's existing env if present.
if [[ ! -f "$APP_DIR/.env" ]]; then
  cat > "$APP_DIR/.env" <<EOF
# Pariter server configuration
PARITER_AI_KEY=your-secret-key-here
EOF
fi

# Validate JSON early to avoid confusing failures later.
if ! "$BUN_BIN" -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.argv[1],'utf8'));" "$APP_DIR/config.json" >/dev/null 2>&1; then
  die "config.json повреждён: невалидный JSON. Проверь введённые данные (кавычки/переводы строк) и повтори установку."
fi

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

# Backup timer (daily)
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
# keep 14 days
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

# Stronger detection: enable nginx-mode only if nginx is the actual listener.
NGINX_80=0
NGINX_443=0
port_busy_by_nginx 80 && NGINX_80=1
port_busy_by_nginx 443 && NGINX_443=1

NGINX_MODE=0
if [[ "$NGINX_ACTIVE" -eq 1 && ( "$NGINX_80" -eq 1 || "$NGINX_443" -eq 1 ) ]]; then
  NGINX_MODE=1
fi

# If ports are busy but nginx is not active -> don't touch ports, but keep going.
CUSTOM_PROXY_NEEDED=0
if [[ "$NGINX_MODE" -eq 0 && ( "$PORT80_BUSY" -eq 1 || "$PORT443_BUSY" -eq 1 ) ]]; then
  CUSTOM_PROXY_NEEDED=1
  warn "Порты 80/443 заняты, но nginx не активен. Я не буду трогать чужую конфигурацию."
  warn "Pariter будет поднят, а прокси/HTTPS нужно будет настроить вручную."
fi

mkdir -p /etc/caddy

# Default: Caddy owns 80/443 (auto HTTPS)
CADDY_PORT=""
LE_DIR="/etc/letsencrypt/live/${DOMAIN}"
HAS_LE_CERT=0
[[ -f "$LE_DIR/fullchain.pem" && -f "$LE_DIR/privkey.pem" ]] && HAS_LE_CERT=1

NGINX_CONFLICT=0
if [[ "$NGINX_MODE" -eq 1 ]]; then
  if nginx_domain_conflict "$DOMAIN"; then
    NGINX_CONFLICT=1
    warn "В nginx уже есть конфиг с server_name ${DOMAIN}. Я не буду его перезаписывать."
  fi

  CADDY_PORT="$(pick_free_port || true)"
  [[ -z "$CADDY_PORT" ]] && die "Не удалось подобрать свободный порт для Caddy."

  # Caddy on localhost:freeport (HTTP only)
  cat > /etc/caddy/Caddyfile <<EOF
http://127.0.0.1:${CADDY_PORT} {
  reverse_proxy 127.0.0.1:${APP_PORT}
}
EOF

  # If nginx vhost is free to create, do it.
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
      # Start with HTTP vhost (needed for HTTP-01 webroot).
      write_nginx_vhost_http "$NGINX_VHOST" "$DOMAIN" "$CADDY_PORT"
      sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=0/' /etc/systemd/system/pariter.service

      # Enable site early so certbot HTTP-01 can pass.
      if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
        ln -sf "$NGINX_VHOST" "/etc/nginx/sites-enabled/pariter-${DOMAIN}.conf"
      fi
      mkdir -p /var/www/letsencrypt

      if ! nginx -t; then
        warn "nginx -t не прошёл. Не могу попытаться выпустить сертификат через HTTP-01."
      else
        systemctl reload nginx || systemctl restart nginx

        # 1) Try automatic HTTP-01 first
        if issue_cert_http_webroot "$DOMAIN" "$ADMIN_EMAIL"; then
          HAS_LE_CERT=0
          [[ -f "$LE_DIR/fullchain.pem" && -f "$LE_DIR/privkey.pem" ]] && HAS_LE_CERT=1
          if [[ "$HAS_LE_CERT" -eq 1 ]]; then
            write_nginx_vhost_https "$NGINX_VHOST" "$DOMAIN" "$CADDY_PORT" "$LE_DIR"
            sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service
            log "[HTTPS] Сертификат выпущен через HTTP-01. Переключаю nginx на HTTPS."
            if nginx -t; then
              systemctl reload nginx || systemctl restart nginx
            else
              warn "nginx -t не прошёл после включения HTTPS. Оставляю конфиг, но nginx не перезагружаю."
            fi
          else
            warn "Certbot завершился успешно, но файлы сертификата не найдены. Оставляю HTTP."
          fi
        else
          warn "Не удалось выпустить сертификат автоматически через HTTP-01."

          # 2) Fallback to DNS-01 manual
          CHOICE="$(prompt "\nПопробовать выпуск через DNS-01 (manual)? (y/N): ")"
          if [[ "${CHOICE,,}" == "y" ]]; then
            success=0
            for attempt in 1 2; do
              if issue_cert_dns_manual "$DOMAIN" "$ADMIN_EMAIL"; then
                success=1
                break
              fi

              warn "Не удалось выпустить сертификат через DNS-01 (попытка ${attempt}/2)."
              if [[ "$attempt" -lt 2 ]]; then
                AGAIN="$(prompt "Повторить попытку выпуска через DNS-01? (y/N): ")"
                if [[ "${AGAIN,,}" != "y" ]]; then
                  break
                fi
              fi
            done

            if [[ "$success" -eq 1 ]]; then
              HAS_LE_CERT=0
              [[ -f "$LE_DIR/fullchain.pem" && -f "$LE_DIR/privkey.pem" ]] && HAS_LE_CERT=1
              if [[ "$HAS_LE_CERT" -eq 1 ]]; then
                write_nginx_vhost_https "$NGINX_VHOST" "$DOMAIN" "$CADDY_PORT" "$LE_DIR"
                sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service
                log "[HTTPS] Сертификат выпущен через DNS-01. Переключаю nginx на HTTPS."
                if nginx -t; then
                  systemctl reload nginx || systemctl restart nginx
                else
                  warn "nginx -t не прошёл после включения HTTPS. Оставляю конфиг, но nginx не перезагружаю."
                fi
              else
                warn "Certbot завершился успешно, но файлы сертификата не найдены. Оставляю HTTP."
              fi
            else
              warn "Не удалось выпустить сертификат через DNS-01. Оставляю HTTP."
            fi
          fi
        fi
      fi
    fi

    if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
      ln -sf "$NGINX_VHOST" "/etc/nginx/sites-enabled/pariter-${DOMAIN}.conf"
    fi

    if ! nginx -t; then
      warn "nginx -t не прошёл. Конфиг записан в: ${NGINX_VHOST}"
      warn "Я не буду перезапускать nginx. Проверь конфиг вручную."
    else
      systemctl reload nginx || systemctl restart nginx
    fi
  else
    warn "NGINX_CONFLICT=1: nginx vhost не создан."
    warn "Добавь вручную reverse proxy для ${DOMAIN} -> http://127.0.0.1:${CADDY_PORT}"
  fi

elif [[ "$CUSTOM_PROXY_NEEDED" -eq 1 ]]; then
  # Ports are busy, nginx not active. Run Caddy on free localhost port.
  CADDY_PORT="$(pick_free_port || true)"
  [[ -z "$CADDY_PORT" ]] && die "Не удалось подобрать свободный порт для Caddy."
  cat > /etc/caddy/Caddyfile <<EOF
http://127.0.0.1:${CADDY_PORT} {
  reverse_proxy 127.0.0.1:${APP_PORT}
}
EOF
  sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=0/' /etc/systemd/system/pariter.service

else
  # Caddy owns 80/443 -> auto HTTPS
  cat > /etc/caddy/Caddyfile <<EOF
{
  email ${ADMIN_EMAIL}
  acme_ca https://acme-v02.api.letsencrypt.org/directory
}

${DOMAIN} {
  reverse_proxy 127.0.0.1:${APP_PORT}
}
EOF

  # Canonicalize: www -> apex (only if www has DNS, otherwise ACME would fail trying to validate www)
  if [[ "${WWW_HAS_DNS}" -eq 1 ]]; then
    cat >> /etc/caddy/Caddyfile <<EOF

www.${DOMAIN} {
  redir https://${DOMAIN}{uri} 308
}
EOF
  fi

  sed -i 's/^Environment=PARITER_SECURE_COOKIE=.*/Environment=PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service
fi

# --- Init DB + admin (as pariter user so DB permissions match)
cd "$APP_DIR"
run_as_pariter "$BUN_BIN" install --no-save >/dev/null 2>&1 || true
run_as_pariter "$BUN_BIN" run scripts/setup.ts

# --- Start services
systemctl daemon-reload
systemctl enable --now pariter
systemctl restart pariter

systemctl enable --now pariter-backup.timer
systemctl start pariter-backup.timer 2>/dev/null || true

# Restart caddy last (after config)
systemctl restart caddy

# Best-effort local health checks (helps debug the proxy chain)
sleep 1
if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
  log "\n[OK] Pariter отвечает на http://127.0.0.1:${APP_PORT}"
else
  warn "Pariter пока не отвечает на http://127.0.0.1:${APP_PORT}. Проверь: journalctl -u pariter -n 120 --no-pager"
fi

if [[ -n "${CADDY_PORT}" ]]; then
  if curl -fsS "http://127.0.0.1:${CADDY_PORT}/api/health" >/dev/null 2>&1; then
    log "[OK] Caddy proxy отвечает на http://127.0.0.1:${CADDY_PORT}"
  else
    warn "Caddy proxy не отвечает на http://127.0.0.1:${CADDY_PORT}. Проверь: journalctl -u caddy -n 120 --no-pager"
  fi
fi

if [[ "$NGINX_MODE" -eq 1 ]]; then
  if curl -fsS -H "Host: ${DOMAIN}" "http://127.0.0.1/api/health" >/dev/null 2>&1; then
    log "[OK] Nginx proxy отвечает локально (Host: ${DOMAIN})"
  else
    warn "Nginx proxy не отвечает локально. Проверь: nginx -t; journalctl -u nginx -n 120 --no-pager"
  fi
else
  # Caddy owns 80/443: verify listener and HTTP->HTTPS redirect.
  if ss -ltnpH 2>/dev/null | grep -qE '(:|\])80\b' && ss -ltnpH 2>/dev/null | grep -qE '(:|\])443\b'; then
    log "[OK] Caddy слушает 80/443"
  else
    warn "Caddy не слушает 80/443. Проверь: ss -ltnp | egrep ':80|:443'; journalctl -u caddy -n 120 --no-pager"
  fi

  # HTTP should redirect to HTTPS
  if curl -fsSI "http://${DOMAIN}/" 2>/dev/null | grep -qi '^location: https://'; then
    log "[OK] HTTP -> HTTPS редирект работает"
  else
    warn "HTTP -> HTTPS редирект не обнаружен. Проверь Caddyfile и логи caddy."
  fi
fi

# --- Final message
if [[ "$NGINX_MODE" -eq 1 ]]; then
  if [[ "$NGINX_CONFLICT" -eq 1 ]]; then
    log "\nГотово. Pariter запущен, Caddy слушает 127.0.0.1:${CADDY_PORT}."
    log "Nginx-конфиг для домена НЕ создавался (конфликт server_name). Настрой proxy_pass вручную." 
  else
    if [[ "$HAS_LE_CERT" -eq 1 ]]; then
      log "\nГотово. nginx(HTTPS) -> Caddy(127.0.0.1:${CADDY_PORT}) -> Pariter(127.0.0.1:${APP_PORT})"
      log "Открой: https://${DOMAIN}"
    else
      log "\nГотово. nginx(HTTP) -> Caddy(127.0.0.1:${CADDY_PORT}) -> Pariter(127.0.0.1:${APP_PORT})"
      log "Открой: http://${DOMAIN}"
      log "\nЕсли позже включишь HTTPS на nginx, включи Secure cookie:"
      log "  sudo sed -i 's/PARITER_SECURE_COOKIE=0/PARITER_SECURE_COOKIE=1/' /etc/systemd/system/pariter.service && sudo systemctl daemon-reload && sudo systemctl restart pariter"
    fi
  fi
elif [[ "$CUSTOM_PROXY_NEEDED" -eq 1 ]]; then
  log "\nГотово. Pariter запущен, Caddy слушает 127.0.0.1:${CADDY_PORT}."
  log "Порты 80/443 заняты другим сервисом. Настрой reverse proxy вручную на ${DOMAIN} -> http://127.0.0.1:${CADDY_PORT}"
else
  log "\nУспех! Открой: https://${DOMAIN}"
fi

log "\nБэкапы БД: ${APP_DIR}/backups (хранение 14 дней, ежедневно 03:17)"
log "\nЛоги:"
log "  sudo journalctl -u pariter -f"
log "  sudo journalctl -u caddy -f"
if [[ "$NGINX_MODE" -eq 1 ]]; then
  log "  sudo journalctl -u nginx -f"
fi
