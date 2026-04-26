#!/usr/bin/env bash
#
# 轻运 AI · 一键部署到腾讯云 / 任意 Linux VPS
#
# 用法（在服务器上）：
#   git clone <repo> && cd occult
#   bash deploy.sh
#
# 思路参考 ../coin/deploy.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── Step 1: 检查系统 ──
log "检查系统环境..."

if ! command -v docker &>/dev/null; then
    warn "Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | sh
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker "$USER"
    log "Docker 已安装。如果提示权限问题，请重新登录后再运行此脚本。"
fi

if ! docker compose version &>/dev/null; then
    err "Docker Compose 不可用，请确认 Docker 版本 >= 24.0"
fi

log "Docker $(docker --version | awk '{print $3}') ✓"

# ── Step 2: 配置 ──
if [ ! -f .env.prod ]; then
    warn ".env.prod 不存在，从模板创建..."
    cp .env.prod.example .env.prod
    warn "请编辑 .env.prod 填入 AI 网关 key:"
    warn "  nano .env.prod"
    warn "填好后重新运行: bash deploy.sh"
    exit 0
fi

# 校验关键 env：AI_GATEWAY_API_KEY 或 DEEPSEEK_API_KEY 至少一个非空
set -a
# shellcheck disable=SC1091
source .env.prod
set +a

if [ -z "${AI_GATEWAY_API_KEY:-}" ] && [ -z "${DEEPSEEK_API_KEY:-}" ]; then
    err ".env.prod 里 AI_GATEWAY_API_KEY 和 DEEPSEEK_API_KEY 都没填，至少要填一个"
fi

log ".env.prod 配置 ✓"

# ── Step 3: 数据目录 ──
mkdir -p data
log "数据目录 ./data ✓"

# ── Step 4: 构建 ──
log "开始构建 Docker 镜像（首次需要 3-5 分钟）..."
docker compose build

log "启动服务..."
docker compose up -d

# ── Step 5: 健康检查 ──
log "等待服务启动..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:3000/api/healthz >/dev/null 2>&1; then
        log "服务已启动 ✓"
        break
    fi
    if [ "$i" -eq 60 ]; then
        warn "服务启动超时（60s）。查看日志："
        warn "  docker compose logs --tail=80 qingyun"
        exit 1
    fi
    sleep 1
done

# ── Step 6: 总结 ──
IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost)"
echo ""
log "═══════════════════════════════════════"
log "  轻运 AI 部署成功！"
log "═══════════════════════════════════════"
echo ""
echo "  本地:   http://localhost:3000"
echo "  公网:   http://${IP}:3000"
echo "  健康:   http://${IP}:3000/api/healthz"
echo ""
echo "  常用命令:"
echo "    docker compose logs -f          # 查看日志"
echo "    docker compose restart          # 重启"
echo "    docker compose down             # 停止"
echo "    docker compose up -d --build    # 重新构建并启动"
echo "    docker compose pull && docker compose up -d  # 拉镜像 + 重启（CI/CD）"
echo ""
echo "  生产建议：把 docker-compose.yml 的 ports 改为 127.0.0.1:3000:3000，"
echo "          再用 nginx / caddy 反代 + 上 https。"
echo ""
