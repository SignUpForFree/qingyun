# `deploy/` — HTTPS 反代 + 备份脚本

## 1. 启用 HTTPS（Caddy + Let's Encrypt）

### 前置

1. **域名 ICP 备案完成**（小程序业务域名必须备案，否则微信会拦）
2. 域名 A 记录指向服务器公网 IP（`192.144.226.27` 当前线上）
3. 服务器**安全组**开放 `80` + `443` 入站（除 3000 之外）
4. `deploy/Caddyfile` 里把 `qingyun.example.com` 替换为你的真实域名，把 `email admin@example.com` 也换掉

### 一行启动

```bash
cd ~/occult
docker compose \
  -f docker-compose.yml \
  -f deploy/docker-compose.caddy.yml \
  up -d
```

第一次启动 Caddy 会自动从 Let's Encrypt 申请证书（约 30s 内），证书走 `caddy_data` volume 持久化（不会每次重启都重申）。

### 验证

```bash
# 内部 healthz 应通
curl -sS http://127.0.0.1:3000/api/healthz

# 外部 https 应通（首次访问会触发证书签发）
curl -sS https://qingyun.example.com/api/healthz

# 证书状态
docker compose exec qingyun-caddy caddy list-modules | grep tls
```

### 收尾

启用 https 后，把仓库根的 `.env.prod` 里：

```
COOKIE_SECURE=true       # 之前是 false（裸 http），现在 https 必须 true
PUBLIC_BASE_URL=https://qingyun.example.com
WECHAT_OA_REDIRECT_URI=https://qingyun.example.com/api/auth/wechat/callback
```

然后 `docker compose ... up -d` 重启 qingyun 容器（caddy 不需要重启）。

## 2. SQLite 备份

见 `scripts/backup-db.sh` + `deploy/crontab.example`。

## 3. 关掉 HTTPS（回退到裸 http，仅 dev / 测试用）

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d
```

不带 caddy override 即可。但生产环境**不要**这么做，小程序拒绝 http。
