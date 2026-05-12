#!/usr/bin/env bash
#
# 轻运 AI · 远程一键回滚（v2，2026-05-09）
# ----------------------------------------------------------------------
# 把 ~/occult.bak.<最近一个时间戳> 还原回 ~/occult，重新拉起容器。
# 配合 scripts/deploy-remote.sh 留下的滚动备份目录使用。
#
# 用法：
#   bash scripts/rollback-remote.sh             # 选最近一个 .bak
#   ROLLBACK_TS=20260509-101530 bash ...        # 指定时间戳
#
# env 覆盖同 deploy-remote.sh：DEPLOY_HOST / DEPLOY_DIR

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-ubuntu@192.144.226.27}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/occult}"
ROLLBACK_TS="${ROLLBACK_TS:-}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

log "枚举服务器备份目录"
BAKS=$(ssh "$DEPLOY_HOST" "ls -1d ${DEPLOY_DIR}.bak.* 2>/dev/null | sort" || true)
if [ -z "$BAKS" ]; then
  err "服务器没有 ${DEPLOY_DIR}.bak.* 备份，无法回滚"
fi
echo "$BAKS" | sed 's/^/    /'

if [ -z "$ROLLBACK_TS" ]; then
  TARGET=$(echo "$BAKS" | tail -n 1)
else
  TARGET="${DEPLOY_DIR}.bak.${ROLLBACK_TS}"
  echo "$BAKS" | grep -qx "$TARGET" || err "指定备份不存在：$TARGET"
fi
log "目标：$TARGET"

read -r -p "确认回滚到 $TARGET？(y/N) " ANS
[ "$ANS" = "y" ] || [ "$ANS" = "Y" ] || { warn "已取消"; exit 0; }

TS=$(date +%Y%m%d-%H%M%S)
ssh "$DEPLOY_HOST" bash -se <<REMOTE
set -e
cd "$DEPLOY_DIR" && docker compose down 2>&1 | tail -3 || true
cd "$HOME"
mv "$DEPLOY_DIR" "${DEPLOY_DIR}.bad.${TS}"
mv "$TARGET" "$DEPLOY_DIR"
cd "$DEPLOY_DIR"
sudo chown -R 1001:1001 data 2>/dev/null || true
docker compose up -d 2>&1 | tail -3
REMOTE

log "等待健康..."
HOST_IP="${DEPLOY_HOST##*@}"
HEALTHZ="http://${HOST_IP}:3000/api/healthz"
for i in $(seq 1 60); do
  CODE=$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTHZ" --max-time 3 2>/dev/null || echo 000)
  [ "$CODE" = "200" ] && { log "回滚完成 ✓ healthz=200"; break; }
  sleep 1
  [ "$i" -eq 60 ] && err "回滚后 healthz 60s 还没 200，自查 docker compose logs"
done

echo ""
log "回滚后状态："
echo "  公网：${HEALTHZ%/api/healthz}"
echo "  失败镜像保留在：${DEPLOY_DIR}.bad.${TS}（确认无问题后可手动删）"
