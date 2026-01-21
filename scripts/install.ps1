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

# Ensure bun is available in current PowerShell session (installer may require terminal restart)
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  $candidate = Join-Path $env:USERPROFILE ".bun\bin"
  if (Test-Path (Join-Path $candidate "bun.exe")) {
    $env:Path = "$candidate;" + $env:Path
  }
}
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  throw "bun не найден в PATH. Перезапусти терминал и запусти установку снова."
}

$base = Join-Path $env:LOCALAPPDATA "Pariter"
New-Item -ItemType Directory -Force -Path $base | Out-Null

Write-Host "Скачиваю Pariter…"
$tmp = Join-Path $env:TEMP ("pariter-" + [guid]::NewGuid().ToString("N") + ".zip")
Invoke-WebRequest -Uri "https://github.com/xl00m/pariter/archive/refs/heads/main.zip" -OutFile $tmp -MaximumRedirection 10

$extract = Join-Path $env:TEMP ("pariter-extract-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $extract | Out-Null
Expand-Archive -Force -Path $tmp -DestinationPath $extract
Remove-Item $tmp -Force

$rootDir = Get-ChildItem -Path $extract -Directory | Select-Object -First 1
if (-not $rootDir) { throw "Не удалось найти распакованный каталог Pariter." }
$src = $rootDir.FullName

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $base "*")
Copy-Item -Recurse -Force -Path (Join-Path $src "*") -Destination $base

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extract

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
