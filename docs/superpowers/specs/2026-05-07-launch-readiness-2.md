# 内测准备 II：HTTPS / 错误聚合 / 备份 / AbortSignal / AI 主备 / 周月 AI / Cron / PIPL / 反馈 / E2E

> 日期：2026-05-07
> 上一阶段：[2026-05-06-launch-readiness.md](./2026-05-06-launch-readiness.md)
> 范围：内测准备清单中可用代码完成的全部项；外部步骤（ICP 备案 / 安全组 / SMS 审核）不在此文档。
> 输出：`pnpm typecheck` clean；新增 11 个能力的代码 + 文档同步。

## 一、清单与状态

| # | 项 | 状态 | 文件 / 入口 |
|---|---|---|---|
| 1 | HTTPS Caddy 反代 | ✅ | `deploy/Caddyfile` + `deploy/docker-compose.caddy.yml` |
| 2 | Sentry 接入 | ✅ | `lib/observability/sentry.ts` + `instrumentation*.ts` + `app/global-error.tsx` |
| 3 | DB 备份脚本 | ✅ | `scripts/backup-db.sh` / `scripts/restore-db.sh` + `deploy/crontab.example` |
| 4 | bazi/meihua AbortSignal 透传 | ✅ | `app/api/divination/{bazi,meihua}/route.ts` cancel→ac.abort |
| 5 | AI 网关 backup 切换 | ✅ | `lib/ai/gateway.ts` (lane) + `lib/ai/client.ts` 主失败 retry backup |
| 6 | 周/月 AI reading SWR | ✅ | migration 0003 + `/api/fortune/{weekly,monthly}/regenerate` + ReadingAutoRegen scope |
| 7 | Cron task 注册 | ✅ | `lib/cron/jobs/{daily-fortune-push,daily-summary}.ts` + instrumentation register |
| 8 | PIPL 数据导出 / 注销 | ✅ | `app/api/me/account/{export,delete}/route.ts` + `app/me/settings/_AccountActions.tsx` |
| 9 | 反馈表单 + email | ✅ | `lib/email/*` + `/api/feedback` + `/feedback` 表单 |
| 10 | Playwright 关键 E2E | ✅ | `e2e/{account-pipl,feedback-api,fortune-regenerate}.spec.ts` |
| 11 | 文档同步 | ✅ | 本文 + CLAUDE.md / OPERATIONS.md / .env*.example |

外部（不在代码层）：
- 域名 ICP 备案（最长 20 天，无备案小程序拒收）
- 腾讯云 SMS 模板审核（24-48h）
- 安全组 80 / 443 入站
- 微信小程序提审（含合规公告）

## 二、关键改动详解

### 2.1 HTTPS（Caddy + Let's Encrypt）

为什么用 Caddy 而非 Nginx：

- 自动签 + 自动续 Let's Encrypt（Nginx 要 certbot 单独跑，且 cron 续签出错率高）
- SSE 对 buffer / flush 敏感，Caddy 默认就关 buffer，配置最少
- Caddyfile DSL 比 nginx.conf 简洁 5 倍

`deploy/Caddyfile` 关键特性：

- HSTS / X-Frame-Options 等安全 header 一行 `header { ... }` 搞定
- SSE 路径 `flush_interval -1` 让每个 chunk 立刻 flush（不被网关缓冲攒包）
- SSE 路径 `read_timeout 30m`（普通请求 90s）

`deploy/docker-compose.caddy.yml` 是 override 文件，叠在主 compose 上：

- 收回 qingyun 的 `0.0.0.0:3000` → `127.0.0.1:3000`，强制走 caddy
- 加 caddy 服务 + 80/443 端口 + caddy_data 持久化（证书）

启用步骤见 `deploy/README.md`。

### 2.2 Sentry

设计原则：**SDK 只在 DSN 存在时动态加载**，避免 dev 环境 5MB SDK 进 bundle。

- 服务端（Node + Edge）：`instrumentation.ts → register()` 调 `initSentry()`，里面 `await import("@sentry/nextjs")`
- 客户端：`instrumentation-client.ts` 直接条件 dynamic import（Next.js 16 自动加载此文件）
- 错误兜底：`app/global-error.tsx` 在 React error 边界里手动 `Sentry.captureException`

env 命名约定：

- `SENTRY_DSN` → 服务端
- `NEXT_PUBLIC_SENTRY_DSN` → 客户端（必须前缀 NEXT_PUBLIC_）
- 一般两个填同一个 project DSN
- `SENTRY_TRACES_SAMPLE_RATE`：内测 0 即可（性能 trace 流量大）

`reportError(err, ctx)` 是统一入口，已在 `daily-fortune-push` / `daily-summary` / `account/delete` / `feedback` 里用。

### 2.3 DB 备份

`sqlite3 .backup` 是在线热备，**不会锁库**（与 cp + WAL 不同）。

- 默认输出 `~/qingyun-backup/qingyun-YYYYMMDD-HHMMSS.db.gz`
- 14 天 retention，find -mtime +14 -delete
- 异地：可选 `coscmd upload`（COS_BUCKET 等 env 启用）

`crontab.example` 已写好 02:30 每天调度 + 周日 03:00 docker logs 归档。

恢复脚本会先 stop qingyun 容器 → keep `qingyun.db.bak.<ts>` → cp 还原 → 改 owner 给 1001:1001 → 重启。

### 2.4 AbortSignal 透传

之前 chat 路由已接，bazi/meihua 漏了。这次补：

```ts
// app/api/divination/bazi/route.ts
const ac = new AbortController();
const sse = new ReadableStream<Uint8Array>({
  async start(controller) { /* ... */
    const stream = await chat({ ..., abortSignal: ac.signal });
    /* ... */
  },
  cancel() {
    ac.abort(new DOMException("Client disconnected", "AbortError"));
  },
});
```

并在 catch 里识别 AbortError 不输出 "AI 卡了一下" error frame（不算异常）。

意义：用户关页 / 切路由 → 上游 DeepSeek 请求立刻取消，省一个 ~30k token 的浪费。

### 2.5 AI 网关 backup 切换

现状：`AI_GATEWAY_*`（主）+ `AI_GATEWAY_BACKUP_*`（备）

```ts
// lib/ai/client.ts non-stream 路径
try { result = tryLane("primary"); ... }
catch (primaryErr) {
  if (!hasBackupGateway()) throw;
  result = tryLane("backup");
}
```

注意：**仅 non-stream 路径切**。stream 因为 SSE 半途切换太复杂（已有 token 已发出，client 收到一半），先不做。流式失败仍走前端 fallback 文案。

未来扩展：可以做"流式失败 → 立刻重试 backup 流式 + 前端拼接"，但需要前端协议变化。

### 2.6 周 / 月 AI reading SWR

之前只有 daily 走 SWR：先存 fallback 模板 → 进页面后 ReadingAutoRegen 触发 `/api/fortune/today/regenerate` AI 升级。

现在 weekly / monthly 同模式：

1. migration 0003 给 `fortunes_weekly` / `fortunes_monthly` 加 `reading_source` 列
2. fetch-weekly / fetch-monthly 写 `reading_source: "fallback"`，conflict update **不**覆盖 reading + reading_source（避免 ai 版退回）
3. 新增 `/api/fortune/weekly/regenerate` + `/api/fortune/monthly/regenerate`
4. 新增 `buildPeriodReadingPrompt(period: "week" | "month")`，措辞改为"本周整体趋势"
5. `<ReadingAutoRegen scope="day" | "week" | "month">` 根据 scope 选 endpoint + body 字段
6. fortune 详情页（`app/fortune/[date]/page.tsx`）注入时传 scope

### 2.7 Cron task 注册

之前 `lib/cron` 是空 registry。现在两个内置 task：

| 任务 | cron 表达式（CST） | 行为 |
|---|---|---|
| `daily-fortune-push` | `30 7 * * *` | 统计今日 fortunes_daily 行数，留模板消息推送 hook |
| `daily-summary` | `15 0 * * *` | 昨日新用户 / 各 intent 调用计数 |

注册位置：`instrumentation.ts → register()`。HMR 重复注册被 try/catch 捕获静默跳过。

`CRON_ENABLED=1` 才真调度（dev 默认 0），避免本地长跑反复触发。

### 2.8 PIPL 合规接口

| 接口 | 行为 |
|---|---|
| `GET /api/me/account/export` | 一次性 JSON 下载全数据 |
| `POST /api/me/account/delete` body=`{"confirm":"DELETE"}` | cascade 删用户全部数据 + 清 cookie |

`export` 实现要点：

- `Promise.all` 并发查 6 个表 + 1 个 inArray 子查询（profiles → fortunes / messages）
- 不导出 `wechat_bind.raw_userinfo`（防 session_key 等敏感凭据泄漏）
- `Content-Disposition` 强下载 + `Cache-Control: no-store`

`delete` 实现要点：

- body 必须 `confirm: "DELETE"`（防误触 / 防自动化攻击）
- 单条 `DELETE FROM users WHERE id=?` 触发全表 cascade（schema 上每个相关表都 `ON DELETE CASCADE`）
- 服务端清 cookie，前端 `router.replace("/")`

UI：`app/me/settings/_AccountActions.tsx` 客户端组件，注销账号是两步确认（必须输入 "DELETE" 字符串）。

### 2.9 反馈表单 + email

新增 `lib/email/`：

- `provider.ts`：`EmailProvider` 接口
- `console.ts`：dev 默认；只 console.info
- `smtp.ts`：动态 import nodemailer（不强依赖，缺包返 reason=`nodemailer_not_installed`）
- `index.ts`：`createEmailProvider({ type? })` + 单例 `email`

`/api/feedback`：

- KV 限流 24h × 5 条/user
- 调 `email.send` → console / SMTP
- 写入 `[feedback]` 日志方便回查

`/feedback` 页：表单 + mailto 兜底。

### 2.10 E2E

新增 3 个 spec：

| 文件 | 覆盖 |
|---|---|
| `e2e/account-pipl.spec.ts` | dev-login → chat → export 验字段 → delete 错 confirm 400 → 正确 confirm 200 |
| `e2e/feedback-api.spec.ts` | validation 400 + 5 次 ok + 第 6 次 429 |
| `e2e/fortune-regenerate.spec.ts` | weekly/monthly 校验 400 + 鉴权后 200 / 404 路径 |

## 三、未做 / TODO

| 项 | 备注 |
|---|---|
| 域名 ICP 备案 | 外部，最长 20 天 |
| 腾讯云 SMS 模板审核 | 外部，24-48h |
| WAF / DDoS（云防火墙） | 外部，控制台开 |
| 微信模板消息真发送 | `daily-fortune-push` 已留 hook，需写 `wx.subscribe-message` 调用 + 限速 |
| 解梦词库 / vector 检索 | spec §X，独立项目 |
| 出生地经纬度查表 | 八字仍用上海兜底；可接 IP geo / 静态城市表 |
| 闲聊敏感词库扩充 | 用户明确跳过本轮 |
| 流式 backup 切换 | 当前 only non-stream 切；流式因前端协议复杂未做 |
| 小程序流式 chat | 现 stub；wx 不直接支持 SSE，要么 long-polling 要么 WebSocket |
| 同手机号两端登录合并 | unionid 合并已做（H5 ↔ 小程序），但纯手机号合并还需要业务规则 |

## 四、验证

```bash
pnpm typecheck   # 0 error
pnpm test        # 全量单测
pnpm test:e2e    # 跑 3 个新 spec（需 dev server）

# 部署后冒烟
curl -sS http://127.0.0.1:3000/api/healthz
curl -sS https://yourdomain.com/api/healthz   # caddy 起后

# 验证 cron 注册
docker compose logs qingyun | grep "\[cron\] scheduled"
```

部署前 `.env.prod` 检查 17+ 关键 env：

```
SESSION_SECRET, AI_GATEWAY_API_KEY, WECHAT_APPID, WECHAT_APPSECRET,
TENCENT_SMS_*, WECHAT_MINI_APPID, WECHAT_MINI_APPSECRET,
SENTRY_DSN（可选）, EMAIL_PROVIDER, FEEDBACK_EMAIL_TO
```
