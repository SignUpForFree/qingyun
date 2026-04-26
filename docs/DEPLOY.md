# 部署到腾讯云 / Linux VPS

参考 `../coin` 项目的纯 Docker 部署模式。1 个 Next.js 容器 + 本地 SQLite 持久化，不依赖云数据库。

## 一、本地准备

确认仓库根有这几个文件：

- `Dockerfile` — multi-stage（deps → builder → runner）
- `docker-compose.yml` — 单服务 + `./data` volume
- `deploy.sh` — 一键脚本
- `.env.prod.example` — 生产环境模板

## 二、服务器一次性准备

腾讯云 CVM（Ubuntu 22.04 推荐）开通后：

```bash
# 装 docker（脚本会自动跑，提前装也行）
curl -fsSL https://get.docker.com | sh

# 把当前用户加入 docker 组（避免 sudo）
sudo usermod -aG docker "$USER"
# 重登一次让组生效
exit
```

腾讯云控制台 → 安全组：放行 **3000/tcp**（或反代后只放 80/443）。

## 三、部署

```bash
git clone <你的仓库> occult
cd occult

# 第一次：拷模板
cp .env.prod.example .env.prod

# 编辑 env 填 ofox.ai 网关
nano .env.prod
```

`.env.prod` 关键三行：

```env
AI_GATEWAY_BASE_URL=https://api.ofox.ai/v1
AI_GATEWAY_API_KEY=sk-of-你的-ofox-key
AI_GATEWAY_MODEL=deepseek/deepseek-v4-pro
```

> ofox.ai 用 `provider/model` 命名空间格式（如 `deepseek/deepseek-v4-pro`、
> `deepseek/deepseek-v3.2`、`z-ai/glm-5.1`、`bailian/qwen3.6-plus`）。
> 控制台 https://ofox.ai/zh/models 看完整列表；切模型只改 `AI_GATEWAY_MODEL` 一行。
>
> deepseek-v4-pro 价格参考：输入 $1.74/M、输出 $3.48/M、缓存读 $0.145/M，
> 1M 上下文窗口、384K 输出。

```bash
bash deploy.sh
```

脚本会：

1. 检查 docker
2. 校验 `.env.prod` 至少填了一个 AI key
3. 创建 `./data` 目录（SQLite + WAL 文件落盘处）
4. `docker compose build` + `up -d`
5. 60 秒内轮询 `/api/healthz` 直到 200

健康检查通过后访问 `http://<服务器IP>:3000`。

## 四、上线后

### 反代 + HTTPS（推荐）

把 `docker-compose.yml` 的 ports 改为 **只对内网**：

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

再用 caddy（自动 LetsEncrypt 证书）：

```caddy
qingyun.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

或 nginx：

```nginx
server {
    listen 443 ssl http2;
    server_name qingyun.example.com;
    ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        # SSE 流式（chat 需要）
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
```

> 注意 `proxy_buffering off`：否则 `/api/chat` 的 SSE 会被 nginx 缓冲到流式失效（spec §6.5 提到的微信 X5 同款问题）。

### 数据备份

SQLite 落在 `./data/qingyun.db`。简单备份：

```bash
# 在服务器上跑（cron 每晚 1 次）
0 3 * * * cd /path/to/occult && cp data/qingyun.db data/qingyun-$(date +\%Y\%m\%d).db
```

或直接 `rsync ./data` 到对象存储 / 另一台机器。

### 升级

```bash
git pull
docker compose up -d --build
```

镜像缓存命中时 30 秒内重启完成。

### 排错

```bash
docker compose logs -f --tail=100        # 实时日志
docker compose exec qingyun sh           # 进容器 shell
docker compose ps                        # 容器状态
ls -la data/                             # 看 SQLite 文件
```

如果 `qingyun-ai` 反复 restart：

1. `docker compose logs --tail=80 qingyun` 看堆栈
2. 多半是 `.env.prod` 里 AI key 写错或网关地址不通
3. 临时把 `RATE_LIMIT_PER_USER_HOURLY` 调高排除限流嫌疑

## 五、和 coin 项目的差异

| 点 | coin | 轻运 AI |
|---|---|---|
| 端口 | 8000 | 3000 |
| 镜像 | python:3.11-slim | node:20-alpine |
| DB | scanner.db (SQLite) | qingyun.db (SQLite) |
| 健康 | `/api/config` | `/api/healthz` |
| 构建 | 单 stage | multi-stage（deps → builder → runner） |
| 多服务 | api + worker | 单服务（chat AI 是同进程内调外部网关，没独立 worker） |

部署节奏几乎一致，可以套同一台 VPS 同一个 docker 网络。
