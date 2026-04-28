#!/bin/bash
# 轻运 AI · 增量修复部署 + health-gate
#
# 用法:
#   bash scripts/deploy-fix.sh <file1> <file2> ...
#   e.g. bash scripts/deploy-fix.sh app/api/chat/route.ts lib/chat/router.ts
#
# 与 scripts/deploy.sh 区别：
#   - 不跑 typecheck / test（按需手动跑）
#   - rsync 单文件而非 git diff（避免 ~/occult 不是 git repo 的 patch 飘）
#   - W1 修：rebuild → up -d 后轮询 /api/healthz 直到 200，防止 5-8s 空窗 502
#
# 退出码：
#   0 deploy + health 通过
#   1 参数错
#   2 rsync 失败
#   3 build 失败
#   4 health-gate 60s 超时

set -euo pipefail

KEY="${SSH_KEY:-$HOME/Downloads/renliang.pem}"
HOST="${DEPLOY_HOST:-ubuntu@43.129.186.82}"
HEALTHZ_EXTERNAL="${HEALTHZ_EXTERNAL:-http://43.129.186.82:3000/api/healthz}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"   # 秒

if [ $# -lt 1 ]; then
  echo "usage: $0 <file1> [file2] [...]" >&2
  exit 1
fi

echo "==> 推送 $# 文件 -> $HOST (tar pipe over ssh)"
# 用 tar pipe 避免 rsync/scp 远端 shell 对 () [] 等特殊字符再展开一次
for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "  ! $f 不存在" >&2
    exit 2
  fi
done
tar -cf - "$@" | ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$HOST" 'cd ~/occult && tar -xf -'
echo "  ✓ 推送 $# 文件"

echo "==> remote rebuild + recreate"
ssh -i "$KEY" "$HOST" bash -s <<'REMOTE'
set -e
cd ~/occult
docker compose build --no-cache qingyun 2>&1 | tail -5
docker compose up -d 2>&1 | tail -3
REMOTE

echo "==> health-gate (W1 修)"
START=$(date +%s)
DEADLINE=$((START + HEALTH_TIMEOUT))
ATTEMPT=0
until [ "$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTHZ_EXTERNAL" --max-time 3 2>/dev/null || echo '000')" = "200" ]; do
  NOW=$(date +%s)
  if [ "$NOW" -ge "$DEADLINE" ]; then
    echo "  ✗ health-gate timeout ${HEALTH_TIMEOUT}s — 容器可能没起来" >&2
    ssh -i "$KEY" "$HOST" 'docker compose -f ~/occult/compose.yaml logs --tail=20 qingyun 2>&1' || true
    exit 4
  fi
  ATTEMPT=$((ATTEMPT + 1))
  printf "  ... try %d (elapsed %ds)\r" "$ATTEMPT" $((NOW - START))
  sleep 1
done
ELAPSED=$(($(date +%s) - START))
printf "\n  ✓ healthz=200 after %ds (%d tries)\n" "$ELAPSED" "$ATTEMPT"

echo "==> smoke /api/auth/wechat"
WECHAT_CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${HEALTHZ_EXTERNAL%/api/healthz}/api/auth/wechat" --max-time 5)
echo "  /api/auth/wechat: $WECHAT_CODE (期望 302 或 503)"

echo "==> deploy-fix done ✓"
