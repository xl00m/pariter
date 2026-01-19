#requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$domain = Read-Host "Домен (для Windows можно оставить пустым, будет localhost)"
$adminEmail = Read-Host "Email администратора"
$adminLogin = Read-Host "Логин администратора"
$adminPass = Read-Host "Пароль администратора (мин. 6)" -AsSecureString
$adminPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass))

if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($adminLogin) -or [string]::IsNullOrWhiteSpace($adminPassPlain)) {
  throw "Все поля обязательны."
}

Write-Host "Устанавливаю Bun (если нужно)…"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  irm https://bun.sh/install.ps1 | iex
}

$base = Join-Path $env:LOCALAPPDATA "Pariter"
New-Item -ItemType Directory -Force -Path $base | Out-Null

Write-Host "Скачиваю Pariter…"
$tmp = Join-Path $env:TEMP "pariter.zip"
Invoke-WebRequest -Uri "https://github.com/xl00m/pariter/archive/refs/heads/main.zip" -OutFile $tmp
Expand-Archive -Force -Path $tmp -DestinationPath $env:TEMP
Remove-Item $tmp -Force

$src = Join-Path $env:TEMP "pariter-main"
if (-not (Test-Path $src)) { throw "Не найден распакованный каталог pariter-main" }

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $base "*")
Copy-Item -Recurse -Force -Path (Join-Path $src "*") -Destination $base

$config = @{
  domain = $domain
  adminEmail = $adminEmail
  adminName = "Admin"
  adminLogin = $adminLogin
  adminPassword = $adminPassPlain
  adminRole = "warrior"
  adminTheme = "dark_warrior"
  port = 8080
  dbPath = (Join-Path $base "pariter.db")
  staticDir = (Join-Path $base "static")
} | ConvertTo-Json -Depth 5

Set-Content -Path (Join-Path $base "config.json") -Value $config -Encoding UTF8

Write-Host "Инициализирую БД и админа…"
Push-Location $base
bun run scripts/setup.ts
Pop-Location

Write-Host "Готово. Запуск:"
Write-Host "  cd $base"
Write-Host "  bun run src/index.ts"
Write-Host "Открой: http://localhost:8080"
