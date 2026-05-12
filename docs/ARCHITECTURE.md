# 轻运 AI · 架构与演进路线（Beta → 稳定 Agent → 高并发 → 多业务复用）

> 起草时间：2026-05-04
> 目标读者：未来的我 / 共同维护者 / 接手做小程序前端 & 业务扩展的开发
> 范围：仅讲架构、设计权衡、遇到的问题、未来演进。**部署看 `DEPLOY.md`**，**算法看 `superpowers/specs/`**。

---

## 0. 一句话总结

**当前是「Web H5 骨架 + 5 类玄学业务 + DeepSeek v4 Pro 直连 + SQLite 单机部署」的可运行 Beta。架构对未来扩展友好，但要做小程序运营前必须补 3 件事：小程序登录、HTTPS 反代、合规词库。要扛 5k+ DAU 时再考虑 PostgreSQL + Redis + 队列。**

---

## 1. 技术栈与开发语言决策

### 1.1 当前栈

| 层 | 选型 | 关键依赖 |
|---|---|---|
| 后端语言 | **TypeScript / Node 20+** | 与前端同语言 + 同仓库 + 同部署单元 |
| 框架 | **Next.js 16 App Router**（Edge middleware + Node API routes） | SSE 流式 + 服务端渲染 + 一份代码两端 |
| ORM | **Drizzle ORM** | 类型安全，schema-as-code，启动自动 migrate |
| 数据库 | **SQLite (better-sqlite3, WAL mode)** | 零运维，单文件持久化 |
| AI SDK | **`ai` v6 + `@ai-sdk/openai-compatible`** | 一层抽象适配 DeepSeek / OpenAI / 通义 / 智谱 / 自建 |
| 模型 | **DeepSeek v4 Pro**（直连 `https://api.deepseek.com`） | 国内可用、价格友好、原生 function calling |
| 包管理 | **pnpm 10.33** | 镜像层硬链接、isolated layout |
| 部署 | **Docker Compose** + 腾讯云 CVM | 单容器 + 数据卷，已实战 |
| 测试 | **Vitest + Playwright** | 1303 单测 + e2e 黑盒流程 |

### 1.2 为什么是 Node + Next.js（不是 Python / Go / Java）

| 候选 | 否决理由 |
|---|---|
| Python (FastAPI + Celery) | ① AI 编排好，但**前后端语言分裂**，1 人团队多写一倍前端 BFF；② SSE 长连虽然能做，但 Next.js 的 Streaming + RSC + middleware 体感更顺；③ 部署多一层（uvicorn/gunicorn vs node server.js） |
| Go (Gin + sqlx) | ① 玄学业务**几乎全是字符串处理 + JSON + Prompt 拼接**，性能不是瓶颈；② 缺少成熟的 AI Streaming SDK；③ 类型严格但**业务变更频繁**（玄学算法迭代快），开发速度比 TS 慢 |
| Java (Spring Boot) | 重，单容器内存 ≥ 512MB，2C4G 小腾讯云不友好；JVM 冷启动慢；与玄学业务"轻量、快速试错"的气质不匹配 |

**结论：保持 TypeScript 全栈。** 理由：
- 前端（H5 + 未来小程序 BFF）和后端共享类型 / 校验 schema（`zod` 一份）
- AI Streaming（SSE 6 事件协议）在 Next.js Route Handler 里**最自然**，`new ReadableStream` + `controller.enqueue` 即可
- 单容器跑得动，单镜像 ~250MB，一台 2C4G 腾讯云能扛 1k+ DAU

### 1.3 微信小程序前端建议

**前端建议另起一个仓库**（不要塞进 `app/` 路由）：

```
qingyun-miniprogram/        # 单独仓库
├── pages/                  # 小程序页面
├── components/
├── api/                    # wx.request 封装，base url 指向后端
├── app.json                # 小程序配置
└── project.config.json
```

**技术选型**：
- 原生小程序（WXML + WXSS + JS） + **TypeScript 模式** —— 学习成本最低
- 或 **Taro 4** —— 一份代码同时打小程序 + H5（如果未来要多端）
- **不推荐 uni-app / Remax**：生态衰退、社区活跃度差。

**对接现有后端**：只需要把当前 H5 的 `fetch('/api/...')` 替换成 `wx.request({ url: 'https://qingyun.example.com/api/...' })`，再加 JWT 头（见 §3.2）。

---

## 2. 当前架构（已实现）

### 2.1 系统拓扑

```
┌────────────┐    HTTPS     ┌──────────────────────────────────┐
│  小程序     ├──────────►   │  Caddy / Nginx (反代 + LE 证书)    │
│  /  H5     │              └────────────────┬─────────────────┘
└────────────┘                               │
                                  127.0.0.1:3000
                                              │
                              ┌───────────────▼───────────────┐
                              │  Next.js 16 (Node runtime)     │
                              │  ┌──────────────────────────┐  │
                              │  │ middleware.ts (鉴权门)    │  │
                              │  └────────────┬─────────────┘  │
                              │               │                │
                              │  ┌────────────▼────────────┐   │
                              │  │ app/api/* Route Handler │   │
                              │  │   /chat (SSE 6 事件)     │   │
                              │  │   /divination/{4 类}     │   │
                              │  │   /auth/wechat (OAuth)  │   │
                              │  └────┬─────────────┬──────┘   │
                              │       ▼             ▼          │
                              │  lib/chat/router.ts            │
                              │  lib/ai/{client,gateway,…}     │
                              │  lib/{bazi,meihua,…}/算法      │
                              └────────────┬───────────────────┘
                                           │
                ┌──────────────────────────┴──────────────┐
                │                                          │
                ▼                                          ▼
      ┌──────────────────┐                     ┌──────────────────┐
      │  SQLite (WAL)     │                     │  DeepSeek v4 Pro  │
      │  /app/data/       │                     │  api.deepseek.com │
      │  qingyun.db       │                     │  (HTTPS)          │
      └──────────────────┘                     └──────────────────┘
```

### 2.2 关键模块清单（已实现）

| 模块 | 文件 | 已经做的事 |
|---|---|---|
| AI 网关 | `lib/ai/gateway.ts` | env 三级优先级（`AI_GATEWAY_*` > `DEEPSEEK_*` > 默认）；切上游零代码改动 |
| AI 主入口 | `lib/ai/client.ts` | `chat(input)` 流式 / 非流式两种签名，60s 超时，fallback 兜底 |
| 意图分类 | `lib/ai/intent.ts`、`intent-keywords.ts` | 5 类（chat/divination/dream/bazi/meihua）；keyword 优先 LLM 兜底 |
| 摘要 | `lib/ai/summarizer.ts` | 12 条触发，K=8 滑窗 + summary 拼 prompt |
| 限流 | `lib/ai/rate-limit.ts` | 按 intent 分桶（chat 30, bazi/dream/meihua 8, divination 12 / 小时） |
| 输出清洗 | `lib/ai/output-sanitizer.ts` | 落库前清 Markdown 标题/加粗 + 禁词兜底 |
| 路由器 | `lib/chat/router.ts` | intent 分流：chat 流式、其他 4 类引导卡（slip_type_picker / dream_choice / bazi_focus_picker / meihua_number_input） |
| SSE | `lib/chat/sse.ts` | 6 事件协议（meta/token/card/progress/done/error）+ 25s 心跳防代理切连 |
| 八字 | `lib/bazi/`、`lib/profile/bazi-pillars.ts` | 真太阳时 + 干支五行十神 + 神煞 + 大运流年 + V2 prompt 模板 |
| 梅花易数 | `lib/divination/meihua-v2.ts` | 报数→上下卦→变爻→V2 prompt |
| 抽签 | `lib/divination/slips.ts` | 100 签字典 seed + 6 维度（综合/事业/财运/姻缘/贵人/平安） |
| 解梦 | `lib/divination/dream-parser.ts` | 快速 / 精准两档，含 vector 检索 prompt 占位 |
| 鉴权 | `lib/auth/session.ts` | `qy_uid` cookie，httpOnly + sameSite=lax；微信服务号 OAuth callback 已有 |
| 数据库 | `lib/db/{client,schema}.ts` | 14 张表 schema，启动时 idempotent migrate |
| 安全 | `lib/safety/sensitive.ts`、`guard.ts` | 词库 + 文本守卫（**词库不全，§4.1 必须补**） |
| Cron | `lib/cron/index.ts` | 注册中心 stub（**M5 才接 node-cron**） |
| 监控 | `lib/observability/sentry.ts` | initSentry stub（**M5 才接真 SDK**） |

### 2.3 一次 SSE 聊天的全链路（已验证）

```
小程序 wx.request / H5 fetch
  → POST /api/chat { conversationId, text }
  → middleware（cookie qy_uid 校验 → 401 拦截 / 放行）
  → zod 校验（注意 conversationId 用 .nullish() 接 null，#1 防御）
  → safety guardTexts（敏感词阻断）
  → ensureUserId（无 cookie 自动建匿名 uuid）
  → classifyIntent（query > keyword > LLM）
  → checkRateLimit（按 intent 分桶）
  → 写 user message + 更新 conversation.last_message_at
  → routeIntent
       ├ intent=chat   → streamChatReply
       │                   - pull 8 条历史 + summary
       │                   - chat({ stream: true }) → DeepSeek
       │                   - for await chunk → SSE token
       │                   - 落库前 sanitizeAiOutput
       └ intent=其他   → buildGuideCard
                           - 写引导卡 message
                           - SSE card（含 metadata.ui）
  → 25s heartbeat 保持长连
  → finally: maybeSummarize + controller.close
```

实测 5 月 4 日本机：**8.6 秒完成 26 token 流式输出 + done**。

---

## 3. 已经遇到 / 已知的问题

### 3.1 历史上踩过的坑（已解决，记录在 `CLAUDE.md`）

| # | 问题 | 现状 |
|---|---|---|
| #1 | `conversationId: null` 用 `.optional()` 会 400 | 已改 `.nullish()` |
| #2 | `AI_TIMEOUT_MS=30000` 八字/梅花刚好打到 abort | 已建议 ≥ 60000 |
| #6 | 容器 uid=1001 ≠ host uid=1000 → SQLITE_CANTOPEN | 部署文档里有 chown 步骤 |
| #8 | `.env.prod` 重建后 `AI_GATEWAY_API_KEY` 易丢 | 部署后必须 `docker compose exec ... env \| grep` 验 |
| #11 | 流式 token 被 React 18 batching 合到一帧 | 已用 `requestAnimationFrame` 节流 |
| #12 | DatePicker `calendarType` 切换被 null value 吃掉 | 组件内 `useState<CalendarType>` 解耦 |

### 3.2 我现在配置时新发现的问题

#### **问题 A：`/api/dev-login` 路由缺失（已修复）**

`lib/auth/ensure-placeholder-profile.ts:10` 注释、`e2e/{bazi,meihua,history-search}-flow.spec.ts` 全部依赖 `POST /api/dev-login`，但 `app/api/dev-login/route.ts` 没有落地。**本次修复**：新增该路由（仅 `NODE_ENV !== production` 可用，prod 强制 404），同步加入 `middleware.ts` 公开白名单。

> 影响：本地 dev / e2e 现在都能直接 `curl -X POST /api/dev-login` 拿 cookie，不必走完整微信 OAuth。

#### **问题 B（已修复）：DeepSeek v4 Pro 默认开启 reasoning，token 成本翻倍**

实测对比（同一句 "你好"）：

| | thinking 默认（开） | `thinking: { type: "disabled" }` |
|---|---|---|
| `completion_tokens` | 38（其中 36 是 reasoning_tokens） | **15** |
| 是否含 `reasoning_content` 字段 | 是（"我们被要求..." 思考过程） | 无 |
| 端到端延迟 | 1.99s | 1.65s |
| `/api/chat` 完整流式 | 8.6s | **2.55s（快 70%+）** |

**修复**（`lib/ai/gateway.ts` + `lib/ai/client.ts`）：

1. `getGateway()` 接受 `ThinkingMode` 参数（"disabled" | "enabled"），用 fetch 钩子在 chat-completions 请求 body 注入 `thinking: { type: ... }`，DeepSeek 识别。`@ai-sdk/openai-compatible` v2 没原生支持，但提供 `fetch` 钩子刚好够用。
2. `chat()` 加 `thinking?: ThinkingMode`，**默认 `"disabled"`**。
3. 业务侧分级：
   - **闲聊 / 引导卡 / 摘要 / 意图分类 / 抽签 / 解梦** → 默认 disabled（无修改）
   - **八字 `app/api/divination/bazi/route.ts`** → 显式 `thinking: "enabled"`（命盘多维度推理）
   - **梅花 `app/api/divination/meihua/route.ts`** → 显式 `thinking: "enabled"`（卦象交叉推理）

> 实测一条 "你好" 省 60%+ token + 流式响应快 70%。八字/梅花保留 reasoning 保证解读质量。

#### **问题 C：docker volume 上 `journal_mode=WAL` 偶发回退**（先不管）

WAL 已开，但 `journal_mode = WAL` 在 docker volume 上**有时会失败回退到 DELETE**（依赖宿主文件系统类型）。

**当前定位**：dev 完全不受影响（本地 macOS APFS 没问题），prod 单容器 + 单宿主机也只在写并发非常高时才会撞。1k DAU 内可以**先不管**。

**真撞到时的诊断 + 修复**：

```ts
// lib/db/client.ts migrate 后加一行
const mode = sqlite.pragma("journal_mode", { simple: true });
if (mode !== "wal") {
  console.warn("[db] WAL fallback failed, mode =", mode);
  // 真撞到 prod 写卡：要么换数据卷文件系统（推荐 ext4），
  // 要么直接迁 PostgreSQL（参 §4.3 演进路线）。
}
```

DAU 上 5k 之前不需要做。撞了再说。

#### **问题 D：意图分类 LLM 兜底走 v4 Pro，慢且贵**（替代方案分析）

**现状**：`lib/ai/intent-classifier.ts` 在关键词不命中时调用 LLM 二次分类（`classifyByLLM`），走同一个 v4 Pro，每条消息额外 1 次 AI 调用：
- 延迟：v4 Pro ~600ms-1s + 网络 → 用户感受卡
- 成本：分类只为输出 5 选 1 的 enum，烧整个 v4 Pro 的最贵价格
- 已通过问题 B 的 `thinking: disabled` 默认值缓解了一部分（关 reasoning 后只剩纯分类输出）

**3 个替代方案对比**：

| 方案 | 延迟 | 成本 | 准确率 | 实现工作量 |
|---|---|---|---|---|
| **A. 维持现状（v4 Pro + thinking:disabled）** | 600ms-1s | 高（每条都打） | 高（语义） | 0 |
| **B. 关键词词库扩充 + 拒绝兜底**（不命中就走 chat） | 0ms | 0 | 中（漏召） | 半天扩词库 |
| **C. 走轻量模型分类**（`deepseek-chat` 或第三方廉价模型，提示词压到 30 字） | 200-400ms | 低（~1/10） | 中-高 | 1-2 小时 |
| **D. 本地分类器**（关键词 + 朴素贝叶斯 / fasttext） | <10ms | 0 | 中 | 半天接入 |

**推荐路线**：

1. **短期（Beta 1 个月内）**：保持 A（已经关 reasoning），观察 LLM 兜底命中比例。如果 keyword 命中率 ≥ 90%，那 LLM 调用频率不高，成本可接受。
2. **中期（DAU 上 1k 后）**：切 C —— `lib/ai/intent-classifier.ts` 增加一个独立的 `INTENT_CLASSIFIER_MODEL` env，默认 `deepseek-chat`（无 reasoning 版本）。改动：

```ts
// lib/ai/intent-classifier.ts（未来改动示意）
const lightGateway = getGateway("disabled");
const result = streamText({
  model: lightGateway(process.env.INTENT_CLASSIFIER_MODEL ?? "deepseek-chat"),
  messages: [{ role: "system", content: CLASSIFY_SYSTEM_PROMPT }, ...],
  maxTokens: 10,  // 强制只输出几个 token
});
```

3. **长期（DAU 上 5k 后）**：D —— 训一个本地小分类器（embedding + cosine 或 fasttext），完全不打 LLM。一台 4C8G 机器能扛 1k QPS。

> 当前不动。已通过 B 的 thinking disabled 让本方案的痛感降低 50%+。

#### **问题 E（已修复）：React StrictMode 下 chat 自动消息「点了没反应 + AbortError」**

dev 日志直接给了证据：

```
GET /chat?intent=divination 200 in 470ms       ← 进入页面，autoSend "我要抽灵签"
POST /api/chat 200 in 15ms                      ← server 200 ok（SSE 流刚开就被取消）
[browser] /api/chat fetch failed AbortError: signal is aborted without reason
    at useChatStream.useEffect (use-chat-stream.ts:71:49)
```

**根因（StrictMode 自残）**：

1. mount #1 → `useMountActions` 触发 `send("我要抽灵签")` → fetch 飞起
2. **StrictMode cleanup #1** → 71 行 `abortRef.current?.abort()` **杀掉自己刚发的 fetch**
3. mount #2 → `useMountActions` 的 `sentRef.current === true`，**跳过 send**
4. 用户看到：fetch error + 没有任何回复（误以为「V4 API 没接好」，实际后端 SSE 三事件已成功返回）

**修复**（`app/chat/_components/use-chat-stream.ts`）：

- 删除 71 行 cleanup 的主动 abort（fetch 浏览器会自然 GC，不会泄露）
- send 内部 abort 显式传 `reason`（`new DOMException(..., "AbortError")`），不再触发浏览器原生 "signal is aborted without reason"
- send catch 加 AbortError 静默分支（用户主动取消/旧请求被覆盖时不再 toast）

#### **问题 F（已修复）：db reset 后 13 个 route 全撞 FOREIGN KEY**

dev 日志：

```
SqliteError: FOREIGN KEY constraint failed
POST /api/chat 500 in 60ms
```

**根因**：`pnpm db:reset` 把 `users` 表清了，但浏览器的 `qy_uid` cookie 还指向旧 user。所有调 `ensureUserId()` 的 13 个 route（`/api/chat`、`/api/divination/*`、`/api/me/*`、`/api/conversations/*`...）都会撞同样的 FK 失败。

**修复**：

1. **`lib/auth/session.ts` `ensureUserId` 加 dev-only 自愈**：cookie 有 uid 但 db 没该 user → 自动 `ensureUserWithPlaceholderProfile`。带进程内 `Set` 去重避免每次都打 db。prod 跳过自愈，让真异常浮现。
2. **`/api/dev-login` 复用 cookie 里现有 uid**（db reset 后用户重 dev-login 时复用同一个 uid，db 自愈不丢历史）

#### **问题 G（已修复）：middleware edge runtime 报 "node:path 找不到"**

session 加 `ensure-placeholder-profile` import 时引入的回归。middleware 跑在 edge runtime，间接 import 了 `lib/db/client.ts`（用 `node:path`）就炸。

**修复**：抽 `lib/auth/cookie-keys.ts` 单独存 `SESSION_COOKIE_KEY`，让 middleware 只 import 常量，不串到 db 依赖链。

#### **问题 H（已修复）：`AI_TIMEOUT_MS` 默认值不一致**

`lib/ai/client.ts` 默认 30000ms，但 `CLAUDE.md` §3 #2 警告过 30s 太紧、`lib/env.ts` 已 enforce 最小 60000。`.env.local` 不显式设的人会撞八字/梅花 25s+ 超时。

**修复**：`lib/ai/client.ts` 默认值改为 60000，与 env schema 对齐。

#### **问题 L：是否每次进入能看到之前的结果？（持久化与多端同步分析）**

**短答**：当前架构**已经实现了单设备 + 同浏览器**的历史持久化；但**清 cookie / 换设备 / 微信小程序 vs H5 切换**时历史断档。

##### 当前现状（已实现）

```
浏览器 cookie qy_uid (1年有效, httpOnly)
      │
      ▼
SQLite users(id) ←─ profiles, conversations, messages, fortunes_*
      │
      ▼
HistoryDrawer (/api/chat/conversations?limit=50)
ChatPage (/chat?cid=xxx → SELECT messages WHERE conversation_id=)
```

| 场景 | 是否能看到历史 | 原因 |
|---|---|---|
| 同浏览器关页 → 重开 | ✅ 能 | cookie 还在，user_id 连续，db 没动 |
| 同浏览器换 tab / 标签 | ✅ 能 | 同 cookie |
| 私密窗口（Incognito） | ❌ 看不到原账号 | 私密窗口 cookie 隔离，等于新 user |
| 清 cookie / 换浏览器 | ❌ 看不到原账号 | qy_uid 失效，新 cookie = 新 user |
| 换设备（手机 ↔ 电脑） | ❌ 看不到 | 同上 |
| 微信小程序 ↔ H5 | ❌ 看不到 | 不同登录态（小程序用 wx.login，H5 用服务号 OAuth） |
| dev：`pnpm db:reset` | ❌ 看不到 | db 整个清空（已加 ensureUserId 自愈，但建的是新空 user） |

##### 三种持久化方案对比

| 方案 | 跨设备同步 | 实现工作量 | 风险 | 适用阶段 |
|---|---|---|---|---|
| **方案 1：Cookie + SQLite（当前）** | ❌ 单设备 | 0（已实现） | 浏览器清 cookie 就丢 | Beta 第一周 |
| **方案 2：微信 unionid 绑定**（用户在小程序 / 公众号 / H5 任一处登录后，用 WeChat openid/unionid 绑定到同一个 users.id） | ✅ 跨小程序 / 公众号 / H5 | 1-2 天（小程序登录已计划） | 用户必须先登录 | Beta 上线前 |
| **方案 3：手机号 + OTP**（手机号绑定到 users.id，跨任何设备登录都能恢复） | ✅ 全跨设备 | 0（已有 `/api/auth/phone`） | 用户嫌麻烦 | 可选，配 2 |

##### 推荐路线

1. **当前**：方案 1 已经够用，匿名用户在同一浏览器内能看到自己的所有历史。
2. **Beta 上线前必加**：实现方案 2（微信小程序登录路由 `/api/auth/wechat-mini`）。一旦用户第一次扫码 / 微信登录，把 openid/unionid 绑到 `users.id`，**之后任何设备打开任意端**（小程序 / 公众号 / 浏览器）都能查 `wechatBind.unionid → user_id` 找回历史。
3. **可选补充**：方案 3 作为备用登录手段（用户没绑微信时给个手机号选项）。当前 `app/api/auth/phone/{send-otp,verify}/route.ts` 已实现，前端 `components/auth/PhoneLoginForm.tsx` 也接好了。

##### 一段关键代码（方案 2 的合并逻辑要点）

`app/api/auth/wechat/callback/route.ts` 已经写过类似逻辑（服务号版），小程序版要复用同样的 unionid 优先合并策略：

```ts
// 推荐顺序（已有 wechat callback 实现，照抄即可）
// 1. SELECT user_id FROM wechat_bind WHERE unionid = ?  → 命中：复用同一个 user
// 2. 或 SELECT user_id FROM wechat_bind WHERE openid = ?
// 3. 都没有：以「当前 cookie 里的 qy_uid」为该用户的 user_id（首次绑定，
//    历史记录从匿名期就被认领，无缝衔接）
// 4. 都没绑过 + 也没 cookie：crypto.randomUUID() 新建 user
```

> 这套逻辑在 `lib/wechat/oauth.ts` 已经实现（V1.0 服务号版）。小程序登录路由直接复用 `bindOrCreateUser(openid, unionid)` helper。

#### **问题 K（已修复）：middleware 已被 Next.js 16 标记 deprecated**

启动日志：

> ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.

**修复**：按 [Next 官方 codemod](https://nextjs.org/docs/messages/middleware-to-proxy)：

- `middleware.ts` 重命名为 `proxy.ts`
- 函数名 `middleware` 重命名为 `proxy`
- `middleware.test.ts` → `proxy.test.ts`，引用同步改

不影响行为，只是命名调整。

#### **问题 J（已修复）：客户端断流时 chat() 没把 abort 传给 DeepSeek**

`lib/ai/client.ts` 的 AbortController 之前只挂超时 timer，客户端断开 SSE 时不触发 abort —— DeepSeek stream 还在跑，token 浪费到 stream 自然结束（最坏 60s）。

**修复**：

1. `chat()` 加 `abortSignal?: AbortSignal` 参数，串接到内部 controller：外部 abort 立刻取消上游 fetch
2. `lib/chat/router.ts` 的 `streamChatReply` / `routeIntent` 透传 signal
3. `app/api/chat/route.ts` 顶层创建 `AbortController`，在 SSE `cancel()` 钩子里 `ac.abort()`，并把 `ac.signal` 传给 `routeIntent`
4. `start()` 的 catch 识别 AbortError 静默（用户主动断流不算错）

效果：用户点中断 / 关页 / 后台刷新 → DeepSeek 调用立刻取消，token 不再浪费。

#### **问题 I（已修复）：测试与 dev 共用 `dev.db` 互相干扰**

`lib/profile/repository.test.ts:48` 等多处测试 `beforeEach` 跑 `db.delete(users)` 等清表。**之前跑 `pnpm test` 会把浏览器里的会话 / 用户全清空** —— dev 体验差，且偶发 race condition 导致测试 fail。

**修复**：

- 新增 `vitest.global-setup.ts`：在所有测试 worker 启动前的 main process 强制把 `process.env.DATABASE_URL = "file:./dev.test.db"`（用户没显式设时才设，CI 仍能覆盖）
- `vitest.config.ts` 注册 `globalSetup: ["./vitest.global-setup.ts"]`
- `.gitignore` 加 `dev.test.db*`

效果：dev 用 `dev.db`、测试用 `dev.test.db`，两库互相隔离。`pnpm test` 不再清空浏览器会话；同时 `pnpm dev` 跑测试也不会撞 SQLITE_BUSY。

### 3.3 还没遇到但即将遇到的（运营起来就来）

| 风险 | 触发条件 | 影响 |
|---|---|---|
| 微信小程序审核拒（玄学/封建迷信类目） | 文案直白说"算命/占卜" | 先驳回，反复改文案 → 拖 1-2 周上线 |
| ICP 备案 + 类目 | 国内服务器对外提供服务前 | 通常 7-20 天 |
| AI 输出政治敏感 / 医疗建议 / 自杀引导 | 用户发"我想死/我得了 XX 病" | 合规事故，账号封停 |
| DeepSeek 限流 / 5xx | 高峰期 | 没有 fallback 网关 |
| SSE 在某些公网代理被截断 | 微信 X5 内核 / 4G 弱网 | 已加 25s heartbeat 缓解，仍可能见 |
| 单机 SQLite 写并发 | DAU > 1k | 排队 → 用户感受卡 |

---

## 4. 演进路线图

### 4.1 Beta 上线必做（1-2 周）

| # | 事项 | 改动 | 价值 |
|---|---|---|---|
| 1 | **关闭闲聊 reasoning，按业务分级开** | `lib/ai/client.ts` 加 `reasoning` 参数；`router.ts` 区分 chat / 业务 | 成本省 50%-70% |
| 2 | **微信小程序登录改造**：新增 `/api/auth/wechat-mini`，对接 `wx.login + jscode2session`，返回 JWT | 1 个新 route + 1 处中间件兼容 JWT | 小程序前端能登录 |
| 3 | **接 node-cron** 替换 `lib/cron` stub | 1 个新文件 | 每日运势推送、周月报 |
| 4 | **接 Sentry** + **加 nginx/caddy 反代 + HTTPS** | 部署侧 | 小程序强制 HTTPS；线上能看到错误 |
| 5 | **完善 `lib/safety/sensitive.ts` 词库**：政治 / 医疗 / 极端预测 / 自杀引导 | 词库扩充 + 拒答模板 | 合规上线必备 |
| 6 | **统一 prompt token 监控**：`lib/observability/token-monitor.ts` 累加每次调用 + 落 `cron_runs` | 已有 stub，补实接 | 知道每条消息花多少 |
| 7 | **`/api/chat` 加请求级 timeout**（除现有 SSE 心跳外） | 5 行代码 | 防止用户半截断开后 stream 不释放 |

### 4.2 稳定 Agent 化（M2，1-2 月）

把硬编码 switch 升级为 **AI Tool Calling**：

```ts
// lib/ai/tools/index.ts （新增）
import { tool } from "ai";
import { z } from "zod";

export const baziTool = tool({
  description: "查询用户的八字命盘并按指定维度解读",
  inputSchema: z.object({
    profileId: z.string(),
    focus: z.enum(["综合","事业学业","财运","感情姻缘","人际贵人","平安健康"]),
  }),
  execute: async ({ profileId, focus }) => ({
    chart: await buildChart(profileId),
    focus,
  }),
});

export const meihuaTool = tool({
  description: "用户报 1-3 个数字时起梅花卦",
  inputSchema: z.object({
    profileId: z.string(),
    numbers: z.array(z.number().int().min(1).max(999)).min(1).max(3),
  }),
  execute: async ({ profileId, numbers }) => qiGua(profileId, numbers),
});

// ... slipTool / dreamTool / fortuneTool
```

主流程：

```ts
// lib/chat/router.ts（改造）
const stream = await chat({
  messages,
  systemPrompt: SYSTEM_PROMPT,
  tools: { bazi: baziTool, meihua: meihuaTool, slip: slipTool, dream: dreamTool, fortune: fortuneTool },
  stopWhen: stepCountIs(3),  // 最多 3 轮 tool 调用
  stream: true,
});
```

DeepSeek v4 Pro 原生支持 OpenAI Function Calling，`@ai-sdk/openai-compatible` 直接透传。

**优势**：
- 用户说"我老公最近怎么样"→ AI 自己决定调 `lookup_profile_by_relation` + `bazi(focus=感情姻缘)` 
- 不必为每个新业务硬编码 intent 分支
- 加新工具 = 加一个 `tool({...})` 注册

### 4.3 高并发改造（M3，DAU 5k+ 才做，**不要过早优化**）

| 阶段 | 触发 | 措施 |
|---|---|---|
| **当前** | DAU < 1k | SQLite + 单容器，撑住没问题 |
| **中期** | DAU 1k-10k | ① SQLite → **PostgreSQL 14**（Drizzle 切 driver 几行）；② 引入 **Redis** 做 session / 限流 / 摘要缓存；③ 容器横向 scale × 2-3 |
| **高并发** | DAU > 10k | ④ **BullMQ + Redis** 异步队列：八字/梅花长任务投队列 → 前端轮询 task_id；⑤ Nginx/SLB 长连负载；⑥ DeepSeek 配 fallback 网关（`AI_GATEWAY_BACKUP_*` env 已留位）；⑦ Prometheus + Grafana 监控 |

**SQLite → PostgreSQL 改动量**：

```ts
// lib/db/client.ts —— 改 5 行
- import { drizzle } from "drizzle-orm/better-sqlite3";
- import Database from "better-sqlite3";
+ import { drizzle } from "drizzle-orm/postgres-js";
+ import postgres from "postgres";
- const sqlite = new Database(dbPath);
+ const sql = postgres(process.env.DATABASE_URL!);
- const db = drizzle(sqlite, { schema });
+ const db = drizzle(sql, { schema });
```

**schema 改动**：
- `text` 干掉 `(strftime(...))` 默认值，改 `timestamp().defaultNow()`
- `text` JSON 列改 `jsonb`
- 14 张表的 `crypto.randomUUID()` 改 `uuid().defaultRandom()`

**预算**：1.5 天（含测试）。

---

## 5. 多业务复用架构（最重要，长期）

### 5.1 设计原则

把现在的 `qingyun-ai` 拆成两层：

```
┌──────────────────────────────────────────────────────────────┐
│           ai-platform-core（通用 AI Agent 平台）               │
│  - AI 网关抽象（OpenAI 兼容上游切换）                          │
│  - SSE 6 事件协议（meta/token/card/progress/done/error）       │
│  - 用户/会话/消息表 + 摘要 + 限流 + 安全词                     │
│  - 微信 OAuth（服务号 + 小程序双轨）                           │
│  - cron + Sentry + 日志                                       │
│  - IntentPlugin 注册中心 / Tool 注册中心                       │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │ 业务通过 plugin / tool 接入
                            │
   ┌────────────────────────┼────────────────────────┐
   ▼                        ▼                        ▼
┌──────────┐         ┌──────────┐            ┌──────────┐
│ 轻运 AI   │         │ 法律咨询  │            │ 医疗问诊 │
│ (玄学)    │         │           │            │          │
│ - 八字    │         │ - 法条 RAG│            │ - 病症 RAG│
│ - 梅花    │         │ - 案例库   │            │ - 药品库  │
│ - 抽签    │         │ - 流程图   │            │ - 急救词  │
│ - 解梦    │         │           │            │          │
│ - 运势    │         │           │            │          │
└──────────┘         └──────────┘            └──────────┘
```

### 5.2 复用关键决策

**100% 复用（一行不改）**：
- `lib/ai/{gateway,client,intent,summarizer,output-sanitizer,rate-limit}.ts`
- `lib/auth/`、`lib/safety/`（词库可继承再扩）、`lib/cron/`、`lib/observability/`、`lib/wechat/`
- `lib/db/client.ts`、`lib/chat/sse.ts`、Dockerfile、docker-compose.yml、`deploy.sh`
- `app/api/{chat,healthz,auth}/`

**改造点（约 5 处）**：

1. **`lib/chat/router.ts` 改成 `IntentPlugin` 注册机制**

```ts
// lib/chat/plugins.ts（新增，后续抽到 core）
export interface IntentPlugin {
  name: string;
  keywords: string[];
  rateLimit: number;
  buildGuideCard?: (ctx: PluginCtx) => Promise<GuideCard>;
  buildPrompt?: (ctx: PluginCtx) => Promise<{ system: string; user: string }>;
  preprocess?: (ctx: PluginCtx) => Promise<Record<string, unknown>>;
  postprocess?: (text: string, meta: unknown) => Promise<{ cleaned: string }>;
}

// 业务侧（轻运 AI）注册
registerIntent({
  name: "bazi",
  keywords: ["八字","排盘","命盘","日主"],
  rateLimit: 8,
  preprocess: async ({ profileId }) => ({ chart: await buildChart(profileId) }),
  buildPrompt: ({ chart, focus }) => buildBaziPrompt({ chart, focus }),
});

// 业务侧（法律咨询）注册
registerIntent({
  name: "case-search",
  keywords: ["合同","纠纷","案例"],
  rateLimit: 12,
  preprocess: async ({ text }) => ({ cases: await searchCases(text) }),
  buildPrompt: ({ cases, text }) => buildLawPrompt({ cases, question: text }),
});
```

2. **`lib/db/schema.ts` 拆**：`schema-core.ts`（users / wechat_bind / phone_bind / conversations / messages / cron_runs / wechat_*）+ `schema-{biz}.ts`（profiles / fortunes_* / slips / gua64）。Drizzle 支持多 schema 文件 import。

3. **`lib/ai/intent-keywords.ts` 改成从 plugin registry 自动收集**。

4. **`app/api/divination/*` 是业务专属**，整组替换。

5. **`components/divination/*`、`components/fortune/*` 等业务 UI 组件替换**。

### 5.3 复用成本估算

| 新业务 | 工作量 |
|---|---|
| AI 法律咨询 | 1.5-2 周（写法条 RAG + 4-6 个 plugin + UI） |
| AI 医疗问诊 | 2-3 周（合规更严，需要医学 RAG + 拒答模板） |
| AI 教育答疑（K12 / 编程） | 1-2 周（题库 + 步骤化讲解 prompt） |
| AI 心理陪伴 | 1.5 周（情绪识别 + CBT 框架 prompt + 转人工逃生） |

**前提**：先在 M2 阶段把 `IntentPlugin` 抽出来。

---

## 6. 给你的开发语言 & 架构建议（明确推荐）

### 6.1 语言：**继续 TypeScript 全栈**

不要换 Python / Go。理由前面说了，三句话总结：
- 玄学/咨询类业务**不缺性能，缺迭代速度**
- AI Streaming 在 Node + Next 是最自然的
- 一份 zod schema 前后端共用，减一半工作

### 6.2 架构：**先收口，再扩张**

短期（Beta 1 个月内）：
- **不要**马上抽 core 包，**业务先稳定**
- **把 `IntentPlugin` 接口先在 `lib/chat/plugins.ts` 内部定义** + 把现有 5 类业务搬过去（不影响外部 API）—— 这是为复用打底，但不会拖慢 Beta

中期（M2，3 个月）：
- 升级 Tool Calling（业务工具注册）
- 把 `lib/ai/`、`lib/auth/`、`lib/db/client.ts`、`lib/chat/sse.ts` 抽成 npm 私有包 `@qingyun/ai-core`

长期（M3，6 个月+）：
- 真要做第二个业务时再把 core 独立成仓库
- **不要在没有第二个业务时就过度抽象**——YAGNI

### 6.3 数据库：**SQLite 撑到 1k DAU，再迁 PostgreSQL**

不要现在就 PG。理由：
- SQLite 单文件备份/迁移/调试体验远好于 PG
- WAL 模式 + 业务读多写少，1k DAU 完全够
- 真到瓶颈再迁，Drizzle 改动 5 行

### 6.4 部署：**单容器 + Caddy + HTTPS 撑到 5k DAU**

不要上 K8s。理由：
- K8s 学习成本 + 节点费用 vs 1 台 4C8G 腾讯云的差距
- 单容器 + watchtower（或 docker compose pull）已经能滚动更新
- 真到要 N 副本时再上 docker swarm 或腾讯云 TKE

### 6.5 监控：**Sentry + 自带的 token-monitor 就够 Beta**

不要上 Prometheus / Grafana / ELK。理由：
- 1 台机器多花 1G 内存跑 stack 不划算
- `docker compose logs` + Sentry 能覆盖 95% 排错
- 真要可视化时上 [Better Stack / Grafana Cloud Free Tier]

---

## 7. 上线 Checklist（建议复制为 issue）

### Beta 上线前（必做） — 2026-05-06 状态

- [x] **闭 reasoning**：`lib/ai/client.ts` 默认 `thinking: "disabled"`；八字/梅花显式 `enabled`（已实现）
- [x] **小程序登录**：新增 `/api/auth/wechat-mini` + JWT，proxy.ts 双通道认证（已实现，`miniprogram/` 骨架已铺）
- [ ] **HTTPS**：Caddy / Nginx + LE 证书（线上仍 http）
- [ ] **合规词库**：`lib/safety/sensitive.ts` 政治/医疗/极端预测/自杀
- [x] **真实 SMS（OTP）**：腾讯云 SMS V20210111 接入（`lib/sms/tencent.ts`），prod 默认 tencent；`MOCK_OTP_BYPASS` prod 强制无效
- [x] **OTP / rate-limit 持久化抽象**：`lib/cache/kv-store.ts` KVStore 接口 + InProcess 实现，env 切 Redis 占位
- [x] **思考链不漏到 UI**：`lib/ai/strip-think-chain.ts` 同步剥 + 流式跨 chunk 状态机
- [x] **八字 / 梅花 Strategy**：`lib/divination-providers/`，env `BAZI_PROVIDER` / `MEIHUA_PROVIDER` 切第三方占位
- [x] **node-cron 调度**：`lib/cron/index.ts` 用 node-cron + `CRON_ENABLED` 守门 + 同名 job 并发 guard
- [ ] **Sentry**：`SENTRY_DSN` 生效 + 错误能看到
- [ ] **数据备份**：crontab 每天 dump SQLite
- [ ] **小程序类目文案**：避开"算命/占卜"，用"国学陪伴/传统文化"
- [ ] **ICP 备案**：域名指向腾讯云 IP

详见：`docs/superpowers/specs/2026-05-06-launch-readiness.md`

### Beta 上线第一周（监控）

- [ ] DeepSeek 日均花费 < ¥50
- [ ] /api/chat p95 < 8s
- [ ] /api/chat p99 < 15s
- [ ] 错误率 < 1%
- [ ] 无政治/医疗敏感输出（人工抽样 100 条）

---

## 8. 联系上下文文档

- 部署 → `docs/DEPLOY.md`
- 算法 spec → `docs/superpowers/specs/2026-04-24-qingyun-ai-design.md`
- 八字测试用例 → `docs/superpowers/specs/bazi-test-cases.md`
- V2.0 全量实现 → `docs/superpowers/specs/2026-04-27-qingyun-full-impl-design.md`
- 视觉 prompts → `docs/superpowers/designs/prompts-all-pages.md`
- **最新已知坑** → `CLAUDE.md` §3
