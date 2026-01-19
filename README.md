# ✦ PARITER ✦

**Вместе. Наравне. Вперёд.**

Pariter — self-hosted веб-приложение для совместного ведения дневника личностного роста: ежедневные победы и уроки, общий путь команды.

## Быстрая установка

### Linux/macOS

```bash
curl -fsSL https://raw.githubusercontent.com/xl00m/pariter/main/scripts/install.sh | sudo bash
```

Если `raw.githubusercontent.com` не резолвится/блокируется, попробуй альтернативу (тот же файл через домен github.com):

```bash
curl -fsSL https://github.com/xl00m/pariter/raw/main/scripts/install.sh | sudo bash
```

### Private repo (рекомендуется)

Для приватного репозитория самый надёжный путь — клонировать по SSH (или по HTTPS с токеном), а затем запускать установщик локально:

```bash
git clone git@github.com:xl00m/pariter.git
cd pariter
sudo bash scripts/install.sh
```

### Windows (PowerShell от администратора)

```powershell
irm https://raw.githubusercontent.com/xl00m/pariter/main/scripts/install.ps1 | iex
```

Если `raw.githubusercontent.com` не резолвится/блокируется, попробуй альтернативу:

```powershell
irm https://github.com/xl00m/pariter/raw/main/scripts/install.ps1 | iex
```

Для private repo на Windows — клонируй репозиторий (git/SSH) и запускай локально:

```powershell
git clone git@github.com:xl00m/pariter.git
cd pariter
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

## Что спросит установщик

- Домен (например: pariter.ru)
- Email администратора
- Логин администратора
- Пароль администратора

## После установки

1. Открой приложение в браузере
2. Войди
3. Перейди в «Спутники» и создай приглашение

## Требования

- VPS Ubuntu/Debian
- 512 MB RAM
- 1 GB диска
- Домен, направленный на IP сервера

## Бэкап

Один файл:

- `/opt/pariter/pariter.db`

## Лицензия

MIT

## Автор

l00m
