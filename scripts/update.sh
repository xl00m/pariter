#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/pariter"
REPO_SSH="git@github.com:xl00m/pariter.git"
REPO_HTTPS="https://github.com/xl00m/pariter.git"

cd "$APP_DIR"

if [[ -d .git ]]; then
  git fetch --all --prune
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    git reset --hard origin/main
  else
    git reset --hard origin/master
  fi
else
  if git ls-remote "$REPO_SSH" >/dev/null 2>&1; then
    git init
    git remote add origin "$REPO_SSH"
  else
    git init
    git remote add origin "$REPO_HTTPS"
  fi
  git fetch --all --prune
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    git checkout -B main origin/main
  else
    git checkout -B master origin/master
  fi
fi

if command -v bun >/dev/null 2>&1; then
  bun install --no-save >/dev/null 2>&1 || true
fi

systemctl daemon-reload
systemctl restart pariter
