#!/usr/bin/env bash
# restore-db.sh — 轻运 AI · 从 backup 恢复 SQLite
#
# 用法：
#   bash scripts/restore-db.sh /home/ubuntu/qingyun-backup/qingyun-20260507-001500.db.gz
#
# 行为：
#   1. 解压 .gz → /tmp
#   2. 停止 qingyun 容器（防写冲突）
#   3. 备份当前 dev.db → 当前.db.bak.<ts>
#   4. cp 还原过去
#   5. 启动 qingyun 容器
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <backup.db.gz>" >&2
  exit 1
fi

SRC="$1"
DB_PATH="${DB_PATH:-/home/ubuntu/occult/data/qingyun.db}"
COMPOSE_FILE="${COMPOSE_FILE:-/home/ubuntu/occult/docker-compose.yml}"

if [[ ! -f "${SRC}" ]]; then
  echo "[restore] backup not found: ${SRC}" >&2
  exit 1
fi

TS="$(date +'%Y%m%d-%H%M%S')"
TMP="/tmp/qingyun-restore-${TS}.db"

echo "[restore] decompressing ${SRC} → ${TMP}"
gunzip -c "${SRC}" > "${TMP}"

echo "[restore] stopping qingyun container"
docker compose -f "${COMPOSE_FILE}" stop qingyun >/dev/null

if [[ -f "${DB_PATH}" ]]; then
  cp "${DB_PATH}" "${DB_PATH}.bak.${TS}"
  echo "[restore] kept old db at ${DB_PATH}.bak.${TS}"
fi

cp "${TMP}" "${DB_PATH}"
sudo chown 1001:1001 "${DB_PATH}" || true

echo "[restore] starting qingyun container"
docker compose -f "${COMPOSE_FILE}" start qingyun >/dev/null

rm -f "${TMP}"
echo "[restore] OK"
