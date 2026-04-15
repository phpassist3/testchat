#!/usr/bin/env bash
# Скрипт развёртывания мини-чата на сервере.
# Предполагается, что репозиторий уже склонирован в /opt/testchat.
#
# Использование:
#   cd /opt/testchat && ./deploy/deploy.sh
#
# Скрипт:
#   1. Проверяет наличие .env (если нет — копирует из .env.example и просит заполнить).
#   2. Пересобирает и перезапускает docker-compose стек.
#   3. Тестирует конфиг хостового nginx и перезагружает его.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[deploy] .env не найден, копирую из .env.example — отредактируйте и перезапустите"
  cp .env.example .env
  exit 1
fi

echo "[deploy] docker compose up --build -d"
docker compose up --build -d

echo "[deploy] Проверяю хостовый nginx"
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx || true
fi

echo "[deploy] Готово. Контейнеры:"
docker compose ps
