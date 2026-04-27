#!/bin/bash
# 轻运 AI · V2.0 milestone 部署脚本（M0.9）
#
# 用法: bash scripts/deploy.sh M{n}
#   e.g. bash scripts/deploy.sh M0
#        bash scripts/deploy.sh M2
#
# 流程：
#   1. 本地 typecheck + test（pre-deploy gate）
#   2. git diff > /tmp/qingyun-{milestone}.patch
#   3. scp patch 到服务器 ~/occult/
#   4. ssh apply patch + docker compose build --no-cache + up -d
#   5. 容器启动后验证 9+ 关键 env 注入（防御 #7）
#   6. internal healthz 200
#   7. 外部 https healthz 200
#
# 防御点（自查）：
#   #6  服务器 ~/occult 不是 git repo，apply 失败时手工 scp 整文件覆盖
#   #7  .env.prod 易丢 AI_GATEWAY_API_KEY，env grep ≥ 9 校验
#   #8  容器 nextjs uid=1001 ≠ host ubuntu uid=1000，sudo chown 已在服务器侧
#   #9  pnpm isolated layout: native 依赖在 .pnpm/，不要 Dockerfile 显式 COPY
#   #14 微信 OAuth 必须微信开发者工具或真机测，不能用 Safari

set -e

MILESTONE="${1:?usage: $0 <milestone> e.g. M0, M1, M2}"
KEY="${SSH_KEY:-$HOME/Downloads/renliang.pem}"
HOST="${DEPLOY_HOST:-ubuntu@43.129.186.82}"
DOMAIN="${DOMAIN:-qingyun.example.com}"
LOCAL_PATCH="/tmp/qingyun-${MILESTONE}.patch"

echo "==> [$MILESTONE] pre-deploy gate (typecheck + test)"
pnpm typecheck
pnpm test

echo "==> generating patch"
git diff > "$LOCAL_PATCH"
PATCH_BYTES=$(wc -c < "$LOCAL_PATCH" | tr -d ' ')
echo "    patch: $LOCAL_PATCH ($PATCH_BYTES bytes)"

if [ "$PATCH_BYTES" = "0" ]; then
  echo "==> empty patch — nothing to deploy"
  exit 0
fi

echo "==> scp -> $HOST"
scp -i "$KEY" "$LOCAL_PATCH" "$HOST:~/occult/"

echo "==> remote apply + build + restart"
ssh -i "$KEY" "$HOST" bash -s <<REMOTE
set -e
cd ~/occult
echo "  applying patch..."
git apply qingyun-${MILESTONE}.patch || { echo "    patch failed — fall back to manual scp"; exit 10; }
echo "  docker build (--no-cache)..."
docker compose build --no-cache
echo "  docker up -d..."
docker compose up -d
sleep 5
echo "  env grep (expect ≥9)..."
ENV_COUNT=\$(docker compose exec -T qingyun env | grep -E '^(WECHAT_|AI_GATEWAY_|SESSION_)' | wc -l | tr -d ' ')
echo "    env count: \$ENV_COUNT"
if [ "\$ENV_COUNT" -lt 9 ]; then
  echo "    FAIL: missing env keys (防御 #7)"
  exit 11
fi
echo "  internal healthz..."
curl -sS -f http://127.0.0.1:3000/api/healthz
REMOTE

echo "==> external https healthz"
if curl -sS -f "https://${DOMAIN}/api/healthz" -o /dev/null; then
  echo "    OK"
else
  echo "    FAIL: ${DOMAIN}/api/healthz not 200 (DNS / Nginx / cert?)"
  exit 12
fi

echo "==> [$MILESTONE] deployed ✓"
echo ""
echo "Manual verification (defense #14):"
echo "  - 微信开发者工具 + 真机各打开 https://${DOMAIN}/"
echo "  - SSE 长连测试：发任意意图，检查 25s 不断（防御 #18）"
