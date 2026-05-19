#!/usr/bin/env bash
#
# 福小运 · 远程部署脚本（v2，2026-05-09）
# ----------------------------------------------------------------------
# 把本地源码推到服务器，让服务器 native amd64 build & 切容器。
#
# 替代旧路径：
#   旧：本地 docker save → scp .tar.gz → ssh load        ← arm/amd 不一致 + 镜像里没 dev-login
#   新：tar 源码 → ssh 解压到 occult-staging              ← 一致 + 永远是最新源码
#       服务器 docker compose build (--no-cache) → up -d
#       原 ~/occult mv 为 ~/occult.bak.<ts> 留作回滚
#
# 用法（默认环境无需任何参数）：
#   bash scripts/deploy-remote.sh
#
# 可选 env 覆盖：
#   DEPLOY_HOST=ubuntu@192.144.226.27   # 默认 = 当前生产
#   DEPLOY_DIR=~/occult                 # 服务器目录
#   NO_CACHE=0                          # 1=docker compose build --no-cache（默认开）
#   RUN_GATE=1                          # 1=跑本地 typecheck+vitest（默认 0 跳过，构建机直跑）
#   HEALTH_TIMEOUT=90                   # 健康检查最长等多少秒
#
# 前置：
#   1. ssh ${DEPLOY_HOST} 能直连（ssh-copy-id 加过公钥 + ssh-agent 缓存 passphrase）
#   2. 服务器装好 docker + docker compose（首次见 deploy.sh）
#   3. 本地有当前仓库根目录的 .env.prod 之外的所有源码（.env.prod 走服务器留档，不上传）
#
# 防御点（自查）：
#   #6  服务器 ~/occult 不是 git repo —— 整目录 mv 备份比 git apply 稳
#   #7  .env.prod 易丢 —— 校验 AI_GATEWAY_API_KEY 与 SESSION_SECRET 已注入容器
#   #8  容器 nextjs uid=1001 ≠ host uid=1000 —— 自动 sudo chown data/
#   #14 BuildKit 缓存：默认 --no-cache，避免老 layer 把新代码盖掉

set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────────────────
DEPLOY_HOST="${DEPLOY_HOST:-ubuntu@192.144.226.27}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/occult}"
STAGING_DIR="${DEPLOY_DIR}-staging"
NO_CACHE="${NO_CACHE:-1}"
RUN_GATE="${RUN_GATE:-0}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

# 找到仓库根（git root；fallback：脚本所在目录的上一级）
if ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi
cd "$ROOT"
[ -f package.json ] || err "找不到 package.json（cwd=$ROOT），请在仓库根跑此脚本"

# ── Step 0：本地 gate（默认跳过，RUN_GATE=1 才跑）────────────────────
if [ "$RUN_GATE" = "1" ]; then
  log "本地 typecheck"
  pnpm typecheck
  log "本地 vitest"
  pnpm test 2>&1 | tail -5
else
  log "跳过 typecheck/test（RUN_GATE=1 可强制跑）"
fi

# ── Step 1：连通性 ───────────────────────────────────────────────────
log "检查 ssh 连通：$DEPLOY_HOST"
ssh -o BatchMode=yes -o ConnectTimeout=5 "$DEPLOY_HOST" 'echo OK' >/dev/null \
  || err "ssh $DEPLOY_HOST 不通，先 ssh-copy-id 或检查 ssh-agent"

# ── Step 2：准备 staging 目录 ────────────────────────────────────────
log "服务器准备 staging 目录：$STAGING_DIR"
ssh "$DEPLOY_HOST" "rm -rf $STAGING_DIR && mkdir -p $STAGING_DIR"

# ── Step 3：tar 源码 stream → 服务器解压 ─────────────────────────────
log "stream 源码到服务器（exclude node_modules / .next / .git / data ...）"
# COPYFILE_DISABLE=1：阻止 macOS tar 打包 ._xxx 扩展属性 → 避免服务器端解压时
# 每个文件一行 'Ignoring unknown extended header keyword LIBARCHIVE.xattr.*' 噪音，
# 把后续完成提示冲出滚屏，让用户误以为脚本卡住未完成
COPYFILE_DISABLE=1 tar --exclude='./node_modules' \
    --exclude='./.next' \
    --exclude='./.git' \
    --exclude='./data' \
    --exclude='./test-results' \
    --exclude='./playwright-report' \
    --exclude='./coverage' \
    --exclude='./dev*.db*' \
    --exclude='./*.tar.gz' \
    --exclude='./.env' \
    --exclude='./.env.local' \
    --exclude='./.env.prod' \
    -czf - . | ssh "$DEPLOY_HOST" "cd $STAGING_DIR && tar -xzf - --warning=no-unknown-keyword"

ssh "$DEPLOY_HOST" "ls $STAGING_DIR/app/api/dev-login/route.ts" >/dev/null \
  || err "源码没到位（dev-login route 没传上）"
log "源码到位 ✓"

# ── Step 4：复用已有的 .env.prod ──────────────────────────────────────
log "从 $DEPLOY_DIR 复用 .env.prod"
ssh "$DEPLOY_HOST" "[ -f $DEPLOY_DIR/.env.prod ] && cp $DEPLOY_DIR/.env.prod $STAGING_DIR/.env.prod" \
  || warn "目标无 .env.prod；首次部署请手动 scp 一份再跑"

# ── Step 5：服务器 native build ──────────────────────────────────────
NO_CACHE_FLAG=""
if [ "$NO_CACHE" = "1" ]; then
  NO_CACHE_FLAG="--no-cache"
fi

echo ""
log "════════ 服务器 docker compose build ${NO_CACHE_FLAG} ════════"
log "  预计 5–8 分钟（首次/deps 改动），中间 BuildKit 输出会滚屏，正常现象"
log "  完成后会自动出现 '[✓] build 完成' 行进入下一步"
echo ""

# 关键：-p occult 固定 compose project name
# 否则在 staging 目录 build 会生成 occult-staging-qingyun 镜像，
# 后续在 occult 目录 up 又找 occult-qingyun（旧），相当于"build 永不生效"
# ServerAliveInterval=60：防止 build 期间 SSH 因无输出而被服务器踢掉（退出码 255）
ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=10 "$DEPLOY_HOST" \
  "cd ${STAGING_DIR} && docker compose -p occult build ${NO_CACHE_FLAG}"

echo ""
log "════════ build 完成 ════════"
echo ""

# ── Step 6：滚动切换 ─────────────────────────────────────────────────
log "滚动切换：停旧 → mv 备份 → 新目录到位 → 沿用 data → up"
TS=$(date +%Y%m%d-%H%M%S)
# 用 quoted heredoc <<'REMOTE'：禁止本地 shell 展开 ($HOME / $DEPLOY_DIR ...)
# 远程需要的变量通过 ssh 命令行 env 前缀显式传入，避开 mac 端路径泄漏
ssh "$DEPLOY_HOST" \
  "DEPLOY_DIR='$DEPLOY_DIR' STAGING_DIR='$STAGING_DIR' TS='$TS' bash -se" <<'REMOTE'
set -e
[ -n "$DEPLOY_DIR" ] && [ -n "$STAGING_DIR" ] && [ -n "$TS" ] || {
  echo "[remote] 缺关键变量 DEPLOY_DIR/STAGING_DIR/TS" >&2; exit 9; }

# 1. 停旧容器（如果还在）— 用固定 project name 防止 docker compose 找错 project
if [ -d "$DEPLOY_DIR" ]; then
  cd "$DEPLOY_DIR"
  docker compose -p occult down 2>&1 | tail -3 || true
fi

# 2. 切到 /tmp 再 mv（避免 cwd 在 DEPLOY_DIR 里被 mv 拽空）
cd /tmp

# 3. 备份旧目录 + staging 上位
if [ -d "$DEPLOY_DIR" ]; then
  mv "$DEPLOY_DIR" "${DEPLOY_DIR}.bak.${TS}"
fi
mv "$STAGING_DIR" "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# 4. 沿用旧 data（保留用户档案/对话历史）
rmdir data 2>/dev/null || true
if [ -d "${DEPLOY_DIR}.bak.${TS}/data" ]; then
  cp -a "${DEPLOY_DIR}.bak.${TS}/data" ./
  echo "  data 沿用旧 SQLite"
else
  mkdir -p data
  echo "  data 全新建立"
fi

# 容器 uid=1001 防御 #8
sudo chown -R 1001:1001 data

# 5. 起容器（-p occult 与 build 时一致）
docker compose -p occult up -d 2>&1 | tail -3
REMOTE
log "容器已起，等待健康..."

# ── Step 7：health-gate ──────────────────────────────────────────────
HOST_IP="${DEPLOY_HOST##*@}"
HEALTHZ="http://${HOST_IP}:3000/api/healthz"
START=$(date +%s); DEADLINE=$((START + HEALTH_TIMEOUT)); TRY=0
until [ "$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTHZ" --max-time 3 2>/dev/null || echo 000)" = "200" ]; do
  TRY=$((TRY+1)); NOW=$(date +%s)
  if [ "$NOW" -ge "$DEADLINE" ]; then
    warn "health-gate timeout ${HEALTH_TIMEOUT}s，最近日志："
    ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && docker compose -p occult logs --tail=40 qingyun" || true
    err "健康检查失败 — 用 bash scripts/rollback-remote.sh 回滚"
  fi
  printf "  ... try %d (elapsed %ds)\r" "$TRY" $((NOW - START))
  sleep 1
done
ELAPSED=$(($(date +%s) - START))
printf "\n"
log "healthz=200 after ${ELAPSED}s (${TRY} tries)"

# ── Step 8：env 注入校验（防御 #7）──────────────────────────────────
log "校验关键 env 注入容器"
ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && docker compose -p occult exec -T qingyun env" \
  | grep -E '^(AI_GATEWAY_API_KEY|SESSION_SECRET|DATABASE_URL|BETA_DEV_LOGIN|NODE_ENV)=' \
  | sed 's/=.\{8\}.*/=***REDACTED***/' \
  || warn "关键 env 未全部注入，检查 .env.prod"

# ── Step 9：完成 ─────────────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════"
log "  部署完成（${TS}）"
log "═══════════════════════════════════════"
echo "  公网：    http://${HOST_IP}:3000"
echo "  健康：    ${HEALTHZ}"
echo "  日志：    ssh ${DEPLOY_HOST} 'cd ${DEPLOY_DIR} && docker compose logs -f qingyun'"
echo "  回滚：    bash scripts/rollback-remote.sh"
echo "  备份：    ${DEPLOY_DIR}.bak.${TS}（旧版镜像 + data，可手动删）"
echo ""
