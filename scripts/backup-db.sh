#!/usr/bin/env bash
# backup-db.sh — 轻运 AI · SQLite 备份
#
# 在线热备：用 sqlite3 .backup 命令（不会锁库，比裸 cp + WAL 更安全）。
# 默认每天保留 14 天，本地 + 可选异地（腾讯云 COS）。
#
# 用法：
#   bash scripts/backup-db.sh                   # 默认本地 ~/qingyun-backup
#   bash scripts/backup-db.sh /custom/path      # 自定 backup 目录
#   COS_BUCKET=qingyun-backup-1300000000 \
#   COS_REGION=ap-guangzhou \
#   COS_SECRET_ID=AKIDxxx COS_SECRET_KEY=xxx \
#   bash scripts/backup-db.sh                   # 启用 COS 上传
#
# 推荐 crontab：见 deploy/crontab.example
set -euo pipefail

DB_PATH="${DB_PATH:-/home/ubuntu/occult/data/qingyun.db}"
BACKUP_DIR="${1:-${BACKUP_DIR:-/home/ubuntu/qingyun-backup}}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TS="$(date +'%Y%m%d-%H%M%S')"
DEST="${BACKUP_DIR}/qingyun-${TS}.db"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "[backup] DB not found: ${DB_PATH}" >&2
  exit 1
fi

# 1) 在线热备（不锁库）
sqlite3 "${DB_PATH}" ".backup '${DEST}'"
gzip -f "${DEST}"
DEST_GZ="${DEST}.gz"
SIZE="$(du -h "${DEST_GZ}" | awk '{print $1}')"
echo "[backup] ${DEST_GZ} (${SIZE})"

# 2) 异地（可选）：腾讯云 COS
if [[ -n "${COS_BUCKET:-}" ]]; then
  if ! command -v coscmd >/dev/null 2>&1; then
    echo "[backup] coscmd not installed; skip remote upload" >&2
    echo "         install: pip3 install coscmd" >&2
  else
    if [[ -n "${COS_SECRET_ID:-}" && -n "${COS_SECRET_KEY:-}" ]]; then
      coscmd config -a "${COS_SECRET_ID}" -s "${COS_SECRET_KEY}" \
        -b "${COS_BUCKET}" -r "${COS_REGION:-ap-guangzhou}" >/dev/null
      coscmd upload "${DEST_GZ}" "qingyun-db/$(basename "${DEST_GZ}")"
      echo "[backup] uploaded to cos://${COS_BUCKET}/qingyun-db/"
    else
      echo "[backup] COS_SECRET_ID/KEY missing; skip remote upload" >&2
    fi
  fi
fi

# 3) 清理：保留近 N 天
find "${BACKUP_DIR}" -maxdepth 1 -name 'qingyun-*.db.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] retention=${RETENTION_DAYS}d cleaned old files"
echo "[backup] OK"
