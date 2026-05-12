# 上线就绪化：抽象层 + 小程序适配 + SMS 接入

> 日期：2026-05-06
> 范围：把 P0 上线阻塞项一次性清掉；为未来切 Postgres / Redis / 第三方排盘 API / 小程序版本预留切换面。
> 输出：`pnpm typecheck` + 1365 测试全部通过；线上路径切换只改 env，不改业务代码。

## 一、目标

| # | 项 | 上线前必须做 | 备注 |
|---|---|---|---|
| 1 | 思考链不能在 chat / divination 出现 | 是 | DeepSeek v4 Pro `thinking: enabled` 偶尔会漏 reasoning 到 textStream |
| 2 | OTP 走真实 SMS（腾讯云） | 是 | 手机号登录是隐私合规必经路径 |
| 3 | 进程内 Map 全部抽到 KVStore 接口 | 是 | OTP / rate-limit / 短期缓存零业务改动切 Redis |
| 4 | 八字 / 梅花 算法走 Strategy Provider | 是 | 未来对接第三方 SaaS / 开源算法库零业务改动 |
| 5 | 小程序登录 + JWT | 是 | wx.login → /api/auth/wechat-mini → JWT，proxy 同时认 cookie + Bearer |
| 6 | 小程序前端骨架 | 是 | 在 `miniprogram/` 子目录，与 H5 共仓库 |
| 7 | DataAccess 抽象（最小） | 否，但留口子 | MessageRepo / ProfileRepo 接口 + sqlite 实现 |
| 8 | Cron 真调度 | 是 | node-cron + CRON_ENABLED env 守门 |
| 9 | env 模板 | 是 | `.env.example` / `.env.prod.example` 补 SMS / KV / Provider / CRON |

## 二、改动清单

### 2.1 思考链剥离

**文件**：

- `lib/ai/strip-think-chain.ts`：纯函数 `stripThinkChain` + 流式状态机 `consumeStreamChunk` / `flushStreamThinkState`
- `lib/ai/output-sanitizer.ts`：`sanitizeAiOutput` 写库前先跑 `stripThinkChain`
- `app/chat/_components/use-chat-stream.ts`：SSE token 进 UI 前先跑 `consumeStreamChunk`，跨 chunk 拼 `<thi` + `nk>` 也能识别

**正则覆盖**：

- `<think>...</think>` / `<thinking>...</thinking>`
- `[思考]...[/思考]` / `[推理]...[/推理]` / `[reasoning]...[/reasoning]`
- 行首 `思考过程：xxx` / `推理过程：xxx` / `我的思考：xxx`（保守只剥单行）

### 2.2 KVStore 抽象

**文件**：

- `lib/cache/kv-store.ts`：`KVStore` 接口 + `InProcessKVStore` 实现 + `createKVStore` 工厂（env `KV_STORE=memory|redis`）
- `lib/cache/index.ts`：全局单例（dev HMR 防多实例）
- `lib/ai/rate-limit-kv.ts`：滑窗 KV 限流（与基于 messages 表的 SQLite count 共存，未来 Redis 上线后切优先路径）

**Redis 实现路径**：在 `lib/cache/kv-store.ts` 占位注释里给出 `class RedisKVStore` 完整签名；接 `ioredis` 后实现 `set/get/incr/expire/ttl` 即可。

### 2.3 SMS 抽象 + 腾讯云接入

**文件**：

- `lib/sms/provider.ts`：`SmsProvider` 接口
- `lib/sms/mock.ts`：dev 用 console 打 OTP
- `lib/sms/tencent.ts`：腾讯云 SMS V20210111 直接 fetch + TC3-HMAC-SHA256 自签名（不依赖 5MB tencentcloud-sdk-nodejs）
- `lib/sms/index.ts`：`createSmsProvider` 工厂 + 单例（env `SMS_PROVIDER=mock|tencent`，prod 默认 tencent）

**env**：

```
SMS_PROVIDER=tencent
TENCENT_SMS_SECRET_ID=...
TENCENT_SMS_SECRET_KEY=...
TENCENT_SMS_REGION=ap-guangzhou
TENCENT_SMS_SDK_APP_ID=14xxxxxxxx
TENCENT_SMS_SIGN_NAME=轻运
TENCENT_SMS_TEMPLATE_ID_OTP=12345xx
```

### 2.4 phone-otp 改 KVStore + SmsProvider

**文件**：`lib/auth/phone-otp.ts`

- 内部 Map → `kv` 单例（key: `qy:otp:{phone}`、`qy:otp-rate:{phone}`）
- `sendOtp` 走 `sms.send({ phone, params: [code, '10'], templateId, signName })`
- `MOCK_OTP_BYPASS` 在 prod 强制无效（即使 env 设 1）
- 整个文件改 async；同步调用方（`/api/auth/phone/send-otp`、`/api/me/phone/verify`）跟着 `await`

### 2.5 Bazi / Meihua Provider（Strategy）

**文件**：

- `lib/divination-providers/bazi.ts`：`BaziProvider` 接口 + `LocalBaziProvider`（调 `lib/bazi/buildChartV2`）+ `RemoteApiBaziProvider`（占位）
- `lib/divination-providers/meihua.ts`：`MeihuaProvider` + `LocalMeihuaProvider`（调 `meihuaV2`）+ `RemoteApiMeihuaProvider`（占位）
- `lib/divination-providers/index.ts`：统一出口
- `app/api/divination/bazi/route.ts`：用 `baziProvider.buildChart(...)`
- `app/api/divination/meihua/route.ts`：用 `meihuaProvider.cast(...)`
- `lib/bazi/index.ts` + `lib/bazi/README.md`：算法库公开 API
- `lib/divination/index.ts` + `lib/divination/README.md`：算法库公开 API

**env**：`BAZI_PROVIDER=local|api`、`MEIHUA_PROVIDER=local|api`

### 2.6 JWT + 小程序登录

**文件**：

- `lib/auth/jwt.ts`：HS256 sign / verify，无三方依赖（`node:crypto`），防 alg=none confusion
- `lib/wechat/mini-program.ts`：`code2Session(code)` 直接打微信 jscode2session
- `app/api/auth/wechat-mini/route.ts`：`wx.login` 后端入口，按 unionid 优先合并 H5 老账号；新用户 tx 建 users + wechat_bind + 默认 profile；返 `{ uid, jwt, isNew }`
- `proxy.ts`：双通道鉴权（cookie 或 `Authorization: Bearer`），edge runtime 仅判 presence
- `lib/auth/session.ts`：`getCurrentUserId` 先 cookie，再 fallback 解 Bearer JWT；签名失败一律视为未登录

### 2.7 小程序骨架

`miniprogram/`：

- `project.config.json`：把 `appid` 换成自己的
- `app.js`：`wx.login` → `/api/auth/wechat-mini` → 缓存 JWT 到 `wx.setStorageSync('qy:auth')`
- `utils/api.js`：wx.request 封装（自动带 `Authorization: Bearer`，401 自愈重新登录）
- `pages/{index,chat,login}/`：3 个最小页面
- `README.md`：登录序列图 + unionid 合并 H5 老账号机制 + 后续 TODO（流式 chat / 原生 onboarding 等）

### 2.8 DataAccess（最小）

**文件**：

- `lib/db/data-access.ts`：`DataAccess` 接口（含 `MessageRepo`、`ProfileRepo`）
- `lib/db/data-access-sqlite.ts`：`SqliteDataAccess` 实现（包含 atomic default-swap 在 transaction 内）+ 单例

**注**：现有 `lib/profile/repository.ts` 暂保留作为 thin wrapper（被 `app/api/me/profiles/*` 等老路径引用）；新路由 / 新 feature 应直接用 `dataAccess.profiles`。Postgres 切换路径：写 `PgDataAccess implements DataAccess`，env `DATABASE_KIND=postgres` 选实现。

### 2.9 Cron node-cron

**文件**：`lib/cron/index.ts`

- node-cron schedule + concurrent guard（同名 job 同时只跑一份）
- env `CRON_ENABLED=1`（prod 默认开 / dev 默认关）
- env `CRON_TZ=Asia/Shanghai`
- error 不让进程崩溃；统一 console.error

### 2.10 env 模板

`.env.example` / `.env.prod.example` 都补：

- `KV_STORE`、`REDIS_URL`（占位）
- `SMS_PROVIDER` + `TENCENT_SMS_*` 全套
- `BAZI_PROVIDER` / `MEIHUA_PROVIDER`
- `CRON_ENABLED` / `CRON_TZ`
- `WECHAT_MINI_APPID` / `WECHAT_MINI_APPSECRET`
- `SESSION_SECRET`（小程序 JWT 签名用，与 cookie 同 key）

## 三、单测覆盖

新增 5 个 test 文件：

| 文件 | 覆盖 |
|---|---|
| `lib/ai/strip-think-chain.test.ts` | 同步剥 / 流式跨 chunk / carry 残留 / 边界 < 字符 |
| `lib/cache/kv-store.test.ts` | get/set/del/incr/expire/ttl + ifAbsent + 工厂 env 切换 |
| `lib/sms/sms.test.ts` | Mock + Tencent（mock fetch）+ 工厂 env 切换 |
| `lib/auth/jwt.test.ts` | 签验 + 篡改 + 过期 + alg=none 攻击 + 缺 secret |
| `lib/divination-providers/providers.test.ts` | 工厂 env 切换 + Local 真跑 + RemoteApi 占位抛错 |

更新 phone-otp test 用 mock SmsProvider 抓 console（grep `params=...`）。

测试总数：1317 → 1365（+48）。

## 四、未做（后续 P1+）

- Redis 实现：`createKVStore({ kind: "redis" })` 当前抛错，需要写 `RedisKVStore` 适配 ioredis
- DataAccess 全量迁移：现在只覆盖 `MessageRepo` / `ProfileRepo`；conversations / fortunes / wechatBind 等仍散在各自 repository
- Postgres 切换：`PgDataAccess` 占位待补；schema 还是 sqlite-only drizzle，需要双写或迁移工具
- 小程序流式 chat：当前 chat 页是 stub；要么后端 `/api/chat?stream=false`，要么前端 `wx.connectSocket` + 后端转 WebSocket
- IP geo / 出生地查表：八字仍用上海 121.47/31.23 兜底
- AbortSignal 透传：bazi / meihua route 的 SSE 还没接 client abort（chat 已接）

## 五、验证清单

```bash
pnpm typecheck     # 0 error
pnpm test          # 121 files / 1365 passed
pnpm lint          # （前 task 未改 lint，预计 clean）
pnpm dev           # 本地起服 + dev-login → 走链路冒烟
```

部署前在 `.env.prod` 必须填齐：

```
SESSION_SECRET=$(openssl rand -base64 64)
AI_GATEWAY_API_KEY=...
WECHAT_APPID=...
WECHAT_APPSECRET=...
TENCENT_SMS_SECRET_ID=...   # ← 新增
TENCENT_SMS_SECRET_KEY=...  # ← 新增
TENCENT_SMS_SDK_APP_ID=...  # ← 新增
TENCENT_SMS_SIGN_NAME=...   # ← 新增
TENCENT_SMS_TEMPLATE_ID_OTP=...  # ← 新增
WECHAT_MINI_APPID=...       # ← 新增（小程序上线后填）
WECHAT_MINI_APPSECRET=...   # ← 新增
```
