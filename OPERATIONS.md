# 轻运 AI · 常用命令速查

本地开发、校验、数据库与测试的入口命令集中在此；部署与线上排错见根目录 `CLAUDE.md` §2–§3。

## 环境要求

- Node.js ≥ 20.10
- pnpm ≥ 9（推荐 `corepack enable` 后使用仓库锁定的 pnpm 版本）

## 安装与开发

```bash
pnpm install          # 安装依赖
pnpm dev              # Next.js 开发服务器（默认 :3000，占用时可能换端口）
```

## 质量 gate（改完代码建议跑一遍）

```bash
pnpm typecheck        # TypeScript --noEmit
pnpm test             # Vitest 单测（全量）
pnpm test:watch       # Vitest 监听模式
pnpm lint             # ESLint
pnpm format           # Prettier 写回
pnpm format:check     # Prettier 只检查
pnpm test:e2e         # Playwright E2E
```

## SQLite / Drizzle

```bash
pnpm db:generate      # 根据 lib/db/schema.ts 生成迁移 SQL（drizzle-kit）
pnpm db:migrate       # drizzle-kit migrate（一般启动应用时会自动 migrate）
pnpm db:studio        # Drizzle Studio 查看数据
pnpm db:reset         # 清空/重置开发库（scripts/db-reset.ts，慎用）
```

开发库路径由环境变量 `DATABASE_URL` 决定，默认多为 `file:./dev.db`。单测通过 `vitest.global-setup.ts` 可指向 `dev.test.db`，避免冲掉本地会话数据。

## 构建与生产运行

```bash
pnpm build            # next build（含 standalone 产出，见 Dockerfile）
pnpm start            # next start（需先 build）
```

Docker / 腾讯云发布流程、环境变量与健康检查见 **`CLAUDE.md`**。

## 远程升级 / 回滚（推荐入口）

```bash
# 全量升级：本地 typecheck+test → tar 源码 → 服务器 native build → 滚动切换 → health-gate
bash scripts/deploy-remote.sh

# 出问题一键回滚到上一个 ~/occult.bak.<ts>
bash scripts/rollback-remote.sh
```

可用 env 覆盖默认（默认 = 当前生产 `ubuntu@192.144.226.27`）：

```bash
DEPLOY_HOST=ubuntu@x.x.x.x DEPLOY_DIR=/home/ubuntu/occult \
NO_CACHE=1 SKIP_GATE=0 HEALTH_TIMEOUT=90 \
bash scripts/deploy-remote.sh
```

旧 `scripts/deploy.sh` / `scripts/deploy-fix.sh` 仍在仓库中（指向已下线的 `43.129.186.82`），建议统一切到上面这两个新脚本。

## 运势相关实现位置（日 / 周 / 月）

| 范围 | 计算与缓存 |
|------|------------|
| 日运 | `lib/fortune/fetch-today.ts` → `fortunes_daily` |
| 周运 | `lib/fortune/fetch-weekly.ts` → `fortunes_weekly`（当周 7 天日运 7 维分数取均值后再算综合分） |
| 月运 | `lib/fortune/fetch-monthly.ts` → `fortunes_monthly`（当月每日均值） |
| 详情页汇总 | `lib/fortune/fetch-fortune-detail.ts` |
| URL | `/fortune/[date]`；`?scope=week` / `?scope=month`；缺省为日运 |

## 抽象层 / Provider 切换（2026-05-06）

| 层 | 接口 | 默认实现 | env 切换 |
|---|---|---|---|
| KVStore | `lib/cache/kv-store.ts` | `InProcessKVStore` | `KV_STORE=memory \| redis` |
| SMS | `lib/sms/provider.ts` | `MockSmsProvider` (dev) / `TencentSmsProvider` (prod) | `SMS_PROVIDER=mock \| tencent` |
| 八字排盘 | `lib/divination-providers/bazi.ts` | `LocalBaziProvider`（lib/bazi 算法） | `BAZI_PROVIDER=local \| api` |
| 梅花起卦 | `lib/divination-providers/meihua.ts` | `LocalMeihuaProvider`（lib/divination/meihua-v2） | `MEIHUA_PROVIDER=local \| api` |
| DataAccess | `lib/db/data-access.ts` | `SqliteDataAccess` | （Postgres 实现 TBD） |

## 微信小程序

```bash
# 在微信开发者工具打开 ./miniprogram
# 把 miniprogram/project.config.json 的 appid 换成自己的
# 把 miniprogram/app.js globalData.baseUrl 指向你的后端
```

后端 env 必须配齐：

```
WECHAT_MINI_APPID=...
WECHAT_MINI_APPSECRET=...
SESSION_SECRET=...   # JWT 签名 key（同 cookie 加密 key）
```

详情见 `miniprogram/README.md` 与 `docs/superpowers/specs/2026-05-06-launch-readiness.md`。

## OTP 短信调试

| 模式 | 表现 |
|---|---|
| `SMS_PROVIDER=mock`（dev 默认） | 发码命令 `[sms:mock] phone=... params=["123456","10"]` 直接打 console |
| `SMS_PROVIDER=tencent` | 真发；失败 reason 见 `tc-error:xxx` / `tc-send:xxx`，去腾讯云控制台查模板审核状态 |
| `MOCK_OTP_BYPASS=1` | dev 任意 6 位数字都通过；prod 强制忽略此 env |

## HTTPS 反代部署（2026-05-07）

把 Caddy 加到 docker compose 起，自动签 Let's Encrypt 证书：

```bash
cd ~/occult
# 先改 deploy/Caddyfile 的域名 + 邮箱
docker compose -f docker-compose.yml -f deploy/docker-compose.caddy.yml up -d
```

**前置**：域名 ICP 备案通过 + DNS A 记录指向服务器 + 安全组开 80/443。

启用 HTTPS 后 `.env.prod` 必须改：

```
COOKIE_SECURE=true
PUBLIC_BASE_URL=https://yourdomain.com
WECHAT_OA_REDIRECT_URI=https://yourdomain.com/api/auth/wechat/callback
```

详见 `deploy/README.md`。

## SQLite 备份 / 恢复

```bash
# 单次手动备份（生产）
bash scripts/backup-db.sh

# 启用 cron（编辑 /etc/crontab 或 crontab -e）
# 见 deploy/crontab.example：每天 02:30 自动备份 + 14 天滚动 + 可选 COS 上传

# 恢复（需停 qingyun 容器）
bash scripts/restore-db.sh /home/ubuntu/qingyun-backup/qingyun-20260507-001500.db.gz
```

环境变量（可选异地）：

```
COS_BUCKET=qingyun-backup-1300000000
COS_REGION=ap-guangzhou
COS_SECRET_ID=...
COS_SECRET_KEY=...
RETENTION_DAYS=14
```

## 错误聚合（Sentry）

填这两个 env 即启用：

```
SENTRY_DSN=https://...@sentry.io/...           # 服务端
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...  # 客户端
```

不填 = 自动 no-op（不进 bundle，不上报）。详见 `lib/observability/sentry.ts`。

## PIPL 合规接口

| 接口 | 行为 |
|---|---|
| `GET /api/me/account/export` | 当前用户全数据 JSON 一次性下载（含 user / profiles / messages / fortunes） |
| `POST /api/me/account/delete` | body 必须 `{"confirm":"DELETE"}`，cascade 删全部数据并清 cookie |

UI 入口在 `/me/settings`（数据导出 + 注销账号两个按钮）。

## 反馈接收

| 接口 | 行为 |
|---|---|
| `POST /api/feedback` | 表单（category/content/contact），KV 限流 24h × 5 条/user，转邮件给 `FEEDBACK_EMAIL_TO` |

UI 入口在 `/feedback`。`EMAIL_PROVIDER=console`（默认）打 console；切 `smtp` 时需装 `nodemailer` + 填 `SMTP_*` env。

## Cron 任务（已注册）

| 任务 | 表达式（CST） | 行为 |
|---|---|---|
| daily-fortune-push | `30 7 * * *` | 当日 fortunes_daily 命中数统计；模板消息推送 TBD |
| daily-summary | `15 0 * * *` | 昨日新用户 / 各 intent 调用次数 console 打点 |

由 `instrumentation.ts` 启动时注册，`CRON_ENABLED=1` 才真调度。
