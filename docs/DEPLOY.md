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

## 三、部署（生产服务器 `~/occult`）

> 腾讯云现机：用 `scp` / `rsync` / `git apply` 同步代码到 `~/occult` 亦可；**不必**在本机再 `git clone` 一遍，以你服务器上实际目录为准。

**1）进入目录**

```bash
ssh -i /path/to/key.pem ubuntu@<服务器IP>
cd ~/occult
```

**2）配置 `.env.prod`**

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

至少保证：

- **AI 网关**：`AI_GATEWAY_API_KEY`；完整 ofox 三行见下
- **会话**：`SESSION_SECRET` — 在 shell 运行 `openssl rand -base64 64`，将**输出字符串**写入 `SESSION_SECRET=`（compose 读 `env_file` 时不会执行 `$(...)`）
- **微信**（若接登录）：`WECHAT_APPID`、`WECHAT_APPSECRET`；其余见模板

ofox 聚合三行（与 `lib/ai/gateway.ts` 一致）：

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

**3）一键部署或手动构建**

```bash
bash deploy.sh
# 或（Dockerfile / 依赖变动大时与 patch 上线同策略）
docker compose build --no-cache
docker compose up -d
```

`deploy.sh` 会：

1. 检查 docker（必要时安装）
2. 若无 `.env.prod` 则从模板复制并提示编辑后重跑
3. 校验 `AI_GATEWAY_API_KEY` 或 `DEEPSEEK_API_KEY` 至少其一非空
4. 创建 `./data`
5. `docker compose build` + `up -d`（脚本内**未**默认 `--no-cache`；大改镜像时请用手动两行）
6. 60 秒内轮询 `/api/healthz` 直到 200

**4）验证（防 env 被覆盖丢失）**

```bash
curl -sS http://127.0.0.1:3000/api/healthz
docker compose exec qingyun env | grep AI_GATEWAY_API_KEY
```

**5）数据卷权限**

容器内进程 uid **1001**，宿主机目录常为 ubuntu **1000**。出现 SQLite 打不开时执行：

```bash
sudo chown -R 1001:1001 ~/occult/data
```

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

有 **git 仓库** 时：

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

生产机若仅是 `~/occult` 目录（非 clone），用本地 `git diff` 打 patch、`scp` 覆盖文件或 `rsync` 同步后，同样 **`build --no-cache`** 再 `up -d`，避免旧 layer 导致“看似部署成功、代码未变”。

镜像缓存命中时重启可很快；**改了 Dockerfile / 依赖结构时不要用缓存**。

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
