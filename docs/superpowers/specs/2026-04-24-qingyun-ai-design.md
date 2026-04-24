# 轻运 AI · V1.0 MVP 设计方案

> **日期**：2026-04-24
> **作者**：edy + Claude（brainstorming skill）
> **状态**：已确认，等待进入实现计划阶段
> **源需求**：`/Users/edy/Downloads/轻运AI需求文档.docx`

---

## 0. 一句话总结

**Next.js + Supabase + DeepSeek + lunar-javascript** 的 1 人 Web MVP，5 周内上线"档案 + AI 对话 + 抽签 + 解梦 + 八字解读 + 首页运势"6 个核心闭环，部署到 Vercel 默认域名作为测试环境。数据模型为多档案做好准备但 UI 不露出；AI 层走 **规则引擎（确定性） + DeepSeek（解读）** 的分离架构，prompt 全部落表便于零发版调优；运势评分用简化版公式，等正式规则引擎到位后只替换一个文件。月成本 < ¥200。

---

## 1. 约束与决策摘要

| 维度 | 决策 | 理由 |
|---|---|---|
| 产品形态 | Web（H5） | 最快上线，后续再扩展小程序/App |
| 团队 | 1 人 | 必须极简技术栈 + 托管服务 |
| 上线目标 | 测试环境（`*.vercel.app`） | 前期不推广，先跑通核心流程给种子用户用 |
| 备案 | 暂不做 | 测试期不需要；正式上线再补 |
| 技术栈 | Next.js 15 + Supabase + DeepSeek + Vercel | 单仓一体化，1 人可维护 |
| 登录方式 | Supabase 匿名登录 | 0 门槛；可后续升级为手机号 |
| 数据范围 | 方案 A（极简 MVP） | 砍梅花易数测算、语音输入、多档案 UI、精准解梦表单、运势推送、会员 |
| 八字计算 | `lunar-javascript` | 开源、免费、支持真太阳时 |
| UI 方案 | shadcn/ui + Tailwind + v0.dev 主视觉 | 1 人做不动全定制 UI |
| AI 模型 | DeepSeek | 国内直连、便宜、中文效果好 |
| AI 缓存 | 按用户+日期缓存运势、按 session 缓存解读 | 省钱 + 支持历史记录 |
| 月成本 | < ¥200 | Vercel Free + Supabase Free + ~¥60–150 DeepSeek |

---

## 2. MVP 功能范围

### 2.1 包含（6 个核心闭环）

1. **M1 档案**：首次打开 → 引导建档案（出生时间、出生地、性别）→ 入库
2. **M2 首页运势**：读档案 → 算八字 + 当日干支 → AI 出 7 维度解读 → 缓存
3. **M3 AI 对话**：意图识别 → 分发到抽签/解梦/八字/通用问答 → 流式返回 → 落库
4. **M4 抽灵签**：6 类主题 + 用户问题 → 随机抽签 → AI 结合签文 + 问题做解读（在 M3 内的子流程）
5. **M5 AI 解梦**：快速模式对话引导 → 三重维度解读（周公 + 弗洛伊德 + 荣格）
6. **M6 八字解读**：档案已存在 → 直接排盘 → AI 解读 + 追问

### 2.2 不包含（V1.1 回补清单）

- 梅花易数测算（爬 buyiju.com → 64 卦解读 → 梅花易数算法）
- 周/月运势详情
- 精准解梦表单
- 语音输入（ASR）
- 每日运势定时推送（cron + 推送渠道）
- 多档案切换 UI（数据模型支持，只是不露出）
- 微信授权登录 + 手机号换绑
- 八字规则引擎对接（等独立 PRD 到）
- 塔罗牌（P1）
- 会员/解锁未来运势
- 自定义域名 + ICP 备案
- Cloudflare 前置加速

---

## 3. 系统架构

### 3.1 总览图

```
 浏览器（国内用户）
   ↓ 直连 *.vercel.app （测试期）
   ↓
 Next.js 15 App Router（Vercel 托管）
 ├─ 前端：RSC + shadcn/ui + Tailwind
 ├─ API Routes：/api/chat (SSE)、/api/fortune/daily、/api/divination/*
 └─ 服务端库：lunar-javascript（八字）+ AI Gateway
   ↓
 Supabase（数据 + 认证 + 存储）
 ├─ Auth (anonymous)
 ├─ Postgres（所有业务数据）
 └─ Storage（头像、签文图）
   ↓
 DeepSeek API（deepseek-chat，流式）
```

### 3.2 模块划分

**功能闭环（用户可见）**：M1–M6，见第 2.1 节。

**基础设施（用户不可见）**：
- **I1 AI Gateway**：统一调 DeepSeek，含流式、超时、错误处理、token 统计、用户级限流
- **I2 意图路由器**：识别 `divination/dream/bazi/meihua/chat` 五种意图，分发到对应 Prompt 模板
- **I3 八字计算器**：lunar-javascript 封装，公历/农历 → 真太阳时 → 四柱干支/五行/十神/大运

### 3.3 核心设计决策

1. **所有"占卜"动作收敛在 AI 对话页**：抽签/解梦/八字都是"对话页 + 不同意图"，1 人只需要做一个对话页的交互。
2. **计算和解读分离**：
   - **计算层**（确定性）：八字、大运、当日干支、签号、卦象 — 全部用代码/库算出来
   - **解读层**（AI）：把计算结果 + 用户问题塞给 DeepSeek，流式返回
   - 好处：可验证、可缓存、成本可控、输出风格可调
3. **首页运势用简化版评分公式先顶上**，规则引擎 PRD 到位后只替换 `lib/fortune/scorer.ts` 一个文件。

---

## 4. 数据模型

所有表开启 **RLS（行级安全）**；用户只能读写自己的数据。

### 4.1 核心表

#### `profiles` — 用户档案（支持多档案，MVP 只露一个）
```sql
id                uuid PK
user_id           uuid FK → auth.users
nickname          text
gender            text              -- 'male' | 'female'
birth_time        timestamptz       -- 精确到分
calendar_type     text              -- 'solar' | 'lunar'
birth_province    text
birth_city        text
birth_district    text
birth_longitude   numeric(9,6)      -- 真太阳时计算
birth_latitude    numeric(9,6)
current_location  jsonb
avatar_url        text
is_default        bool
created_at, updated_at
INDEX (user_id, is_default)
```

#### `bazi_charts` — 八字排盘缓存（绑 profile_id，非 user_id）
```sql
id              uuid PK
profile_id      uuid FK UNIQUE
pillars         jsonb              -- {year:{gan,zhi}, month, day, hour}
five_elements   jsonb              -- {木:2, 火:1, 土:3, 金:1, 水:1}
day_master      text
ten_gods        jsonb
favorable_gods  jsonb              -- 喜用神
luck_pillars    jsonb              -- 大运列表
solar_true_time timestamptz
raw             jsonb              -- lunar-javascript 原始输出
created_at
```

#### `fortunes` — 每日运势缓存（核心省钱点）
```sql
id              uuid PK
profile_id      uuid FK
fortune_date    date
score_overall   int
scores          jsonb              -- 7 维度分数
one_liner       text               -- AI 一句话总评
readings        jsonb              -- 7 维度详细解读
attributes      jsonb              -- 幸运色/方位/时辰等
model           text
tokens_used     int
created_at
UNIQUE (profile_id, fortune_date)
```

#### `conversations` — 对话会话
```sql
id              uuid PK
user_id         uuid FK
profile_id      uuid FK
title           text               -- AI 根据首条消息生成（≤10 字）
last_message_at timestamptz
created_at
```

#### `messages` — 对话消息
```sql
id              uuid PK
conversation_id uuid FK
role            text               -- 'user' | 'assistant' | 'system'
content         text
intent          text               -- 'chat' | 'divination' | 'dream' | 'bazi' | 'meihua'
metadata        jsonb              -- 签号/卦象/UI 指令等结构化信息
tokens_used     int
created_at
```

#### `divination_records` — 占卜/解梦/八字详情（关联到 message）
```sql
id              uuid PK
message_id      uuid FK UNIQUE
type            text               -- 'qianwen' | 'dream' | 'bazi' | 'meihua'
input           jsonb              -- 用户问题/梦境/数字等
result          jsonb              -- 签号+等级+签题 / 卦象 / 排盘结果
ai_reading      text               -- AI 解读全文（markdown）
created_at
```

#### `prompts` — Prompt 版本管理（零发版调优）
```sql
id              uuid PK
key             text UNIQUE        -- 'fortune.daily', 'divination.qianwen', 'dream.parse' 等
version         int
system_prompt   text
user_prompt_tpl text               -- 含 {placeholder}
active          bool
created_at
```

### 4.2 种子表（只读）

#### `divination_slips` — 100 支灵签
```sql
number          int PK             -- 1-100
level           text               -- '上上' | '上吉' | '吉' | '平' | '渐顺' | '慎行'
title           text
poem            text
readings        jsonb              -- {综合, 事业, 财运, 感情, 人际, 健康}
image_url       text               -- 可选
```
**来源**：从需求文档第 69–169 行提取为 SQL seed。

### 4.3 关键设计点

1. `bazi_charts` 跟 **profile_id** 绑，不跟 user_id 绑 — 一个账号可以给多人算八字
2. `fortunes` 按 `(profile_id, fortune_date)` 唯一 — 同一天查 N 次只生成 1 次
3. `messages` 是流水，`divination_records` 是结构化结果 — 通过 `message.metadata.divination_id` 反查原始签文，支持追问
4. RLS 统一策略：`WHERE user_id = auth.uid()` 或通过 `profile_id → profiles.user_id` 反查
5. `prompts` 表让提示词调整不用发版，运营期极其重要

---

## 5. AI 链路设计

### 5.1 意图路由器

```
用户消息
   ↓
[规则层] ← 匹配"我要抽灵签"等固定话术 → 命中直接路由（0 token）
   ↓ 未命中
[DeepSeek 分类]（低温度、极短 prompt，<200 tokens）
   ↓
五选一: divination | dream | bazi | meihua(暂停) | chat
   ↓
分发到对应 handler
```

快捷入口点击时直接带 `?intent=xxx` 参数跳转，跳过识别。

### 5.2 Prompt 模板（落 `prompts` 表）

共 **5 个核心 prompt**：

| key | 场景 |
|---|---|
| `fortune.daily` | 每日运势 7 维度解读（JSON 输出） |
| `divination.qianwen` | 灵签解读（结合签文 + 用户问题 + 选中维度） |
| `dream.parse` | 三重维度解梦（周公 + 弗洛伊德 + 荣格） |
| `bazi.interpret` | 八字命盘解读 |
| `chat.general` | 通用国学问答 |

**共同原则**：
- 年轻化、治愈向语言，禁用"厄运/大凶/倒霉"等负面词
- 把"慎行"级解读转化为"善意提醒"
- 结尾必须给可落地建议 + 温柔安抚（解梦特别强调）
- 每日运势 prompt 输出严格 JSON

### 5.3 每日运势评分公式（MVP 简化版）

```
对每个维度 (7 个)，分数 = 基础分 + 五行匹配调整 + 日柱关系调整
  基础分 = 60
  五行匹配调整 = 当日五行为喜用神 → +15；为忌神 → -10
  日柱关系调整 =
    生我（正印/偏印） → +10
    同我（比肩/劫财） → +5
    我生（食神/伤官） → +5
    我克（正财/偏财） → 财运 +15，其他 +3
    克我（正官/七杀） → 事业 +10，感情/健康 -5
  截断到 [55, 95]，7 维度取平均 = 总分
```

**输入**：`bazi_charts.day_master` + `favorable_gods` + 今日干支（lunar-javascript 实时算）
**输出**：`{ scores: {综合,事业,财运,感情,人际,健康,学业}, overall: 78 }`

**抽象**：`lib/fortune/scorer.ts` 暴露 `computeDailyScore(chart, date) → Scores`；规则引擎到位后只换这一函数。

**属性推荐（幸运色/方位/时辰）**：
- 幸运色 = 当日五行对应色
- 幸运方位 = 当日干支所属方位
- 幸运时辰 = 日柱三合时辰
- 幸运数 = 日柱地支序数
- 其他（幸运花/事物/随身物）= 按五行查静态表
- 全部可覆盖，到位后重写 `lib/fortune/attributes.ts`

### 5.4 AI Gateway 封装

```ts
// lib/ai/client.ts
async function chat({
  intent,          // 选 prompt key + 记录
  variables,       // 填充模板
  stream = true,
  userId,          // token 统计 + 限流
  conversationId,  // 挂消息
}): Promise<ReadableStream | string>
```

内置：
- 流式透传（Vercel AI SDK `streamText`）
- 失败重试 + 降级（超时/限流返回友好 fallback 文本）
- Token 统计（写入 `messages.tokens_used`）
- 用户级限流（每用户每小时 30 条）

---

## 6. 前端架构

### 6.1 路由/页面（MVP 范围）

| 路径 | 用途 |
|---|---|
| `/` | 首页：每日运势（未填档案 → 默认分数 + CTA；已填 → 当日运势） |
| `/onboarding` | 首次建档案（3 步表单） |
| `/chat` | AI 对话主入口（招呼页 + 4 个快捷入口 + 输入框） |
| `/chat/[sessionId]` | 具体对话 |
| `/fortune/[date]` | 运势详情（MVP 只做单日详情；周/月切换在 V1.1） |
| `/me` | 我的 |
| `/me/profile` | 编辑档案 |

### 6.2 目录结构

```
app/
├── layout.tsx
├── page.tsx                     -- /
├── onboarding/page.tsx
├── chat/
│   ├── page.tsx
│   ├── [sessionId]/page.tsx
│   └── _components/
│       ├── ChatWindow.tsx
│       ├── MessageList.tsx
│       ├── QuickActions.tsx
│       ├── SlipAnimation.tsx    -- 摇签 Lottie
│       ├── SlipResultCard.tsx
│       └── HistoryDrawer.tsx
├── fortune/[date]/page.tsx
├── me/
│   ├── page.tsx
│   └── profile/page.tsx
└── api/
    ├── chat/route.ts            -- SSE 流式对话
    ├── fortune/daily/route.ts
    ├── divination/qianwen/route.ts
    ├── divination/dream/route.ts
    ├── divination/bazi/route.ts
    └── profile/route.ts

components/
├── ui/                          -- shadcn 原子组件
├── DatePicker.tsx               -- 公历/农历双轨
├── RegionPicker.tsx             -- 省市区 + 经纬度
└── AvatarUpload.tsx

lib/
├── ai/
│   ├── client.ts                -- DeepSeek gateway
│   ├── prompts.ts
│   └── intent.ts
├── bazi/
│   ├── chart.ts                 -- lunar-javascript 封装
│   ├── solar-time.ts            -- 真太阳时
│   └── stems-branches.ts
├── fortune/
│   ├── scorer.ts                -- 7 维度评分（可替换）
│   └── attributes.ts            -- 幸运色/方位/时辰
├── divination/
│   ├── slips.ts                 -- 从 100 支签随机抽
│   └── dream-parser.ts          -- 梦境内容校验
├── supabase/
│   ├── client.ts                -- 浏览器
│   ├── server.ts                -- 服务端（cookie）
│   └── admin.ts                 -- service role
└── utils/

db/
├── migrations/
├── seed/
│   └── 100_slips.sql            -- 从需求文档提取
└── rls/                         -- 行级安全策略

types/
└── database.ts                  -- Supabase 自动生成类型
```

### 6.3 状态管理原则

**尽量别引新库**：
- 服务端状态：Server Components 直连 Supabase
- 对话流式：`useChat` (Vercel AI SDK)
- 表单：`react-hook-form` + `zod`
- 局部 UI：`useState`
- 全局唯一状态：当前 `profileId`（React Context + cookie 持久化）

### 6.4 关键交互

**(1) 首页运势流程**
```
<HomePage> (Server Component)
  读 profile (cookie 里的 profileId)
    ├─ 无 → 默认分数 + onboarding CTA
    └─ 有 → 查 fortunes (profile_id, today)
        ├─ 命中 → 渲染缓存
        └─ 未命中 → 调 /api/fortune/daily 生成 + 写缓存 + 渲染
```
首屏 SSR、无客户端 loading 闪烁。

**(2) 对话流式（抽签示例）**
```
用户 "我要抽灵签" → POST /api/chat (SSE)
  服务端 classifyIntent → 'divination'
  → 返回 "好，选主题" + 6 按钮 (via message.metadata.ui)
  用户选"事业学业" → 追问 "描述你的问题"
  用户描述 → 随机 slip + AI 流式解读
  前端：摇签动画 → 逐字显示解读
  结果落 divination_records
```

关键：**结构化 UI 通过 `message.metadata.ui: {type:'options', items:[...]}` 驱动前端渲染按钮**，不让 AI 直接输出按钮。

**(3) 摇签/生成动画**
- 摇签：Lottie（`lottie-react` + 免费摇签 JSON）
- AI loading：shadcn `<Skeleton />` + 打字机效果

### 6.5 易忽略但必做的几块

- **PWA + manifest**：用户可"添加到主屏幕"（1 天工作量）
- **微信浏览器兼容**：UA 差异 / SSE 缓冲问题（见风险表）
- **敏感词过滤**：输入的梦境/测算问题需过滤
- **错误边界**：Next.js `error.tsx` 兜底

---

## 7. 交付路径（5 周 MVP）

| 周 | 目标 | 交付物 | 关键动作 |
|---|---|---|---|
| **W1** | 骨架跑通 | 能登录、能填档案、能算八字 | Next.js 初始化 / Supabase 建表 + RLS / 匿名登录 / onboarding 3 步表单 / lunar-javascript 封装 + 单测 |
| **W2** | AI 对话闭环 | `/chat` 来回对话 + 历史记录 | AI Gateway / Prompt 仓库 / `/api/chat` SSE / 对话页 UI / 意图路由规则层 |
| **W3** | 抽签 + 解梦 | 走完两条链路 | 100 签 seed 入库 / 抽签动画 / 解梦对话式引导 / 两种 prompt 落库 |
| **W4** | 首页运势 + 八字解读 | 首页运势 + 八字报告 | Scorer / Attributes / 运势缓存 / 八字解读 handler / v0.dev 出首页视觉 |
| **W5** | 打磨 + 测试上线 | Vercel 默认域名可演示 | 敏感词 / 错误边界 / PWA / 真机测试 / 埋点（Plausible 或 Umami） |

**每周末**必须有可演示的完整用户路径；做不到就砍特性，不往后推。

**关键验证点**：
- **W1 末**：出生信息 → 完整排盘（干支/五行/十神/大运）能对上
- **W2 末**：SSE 在微信 X5 内核里能跑（不能跑要改 fetch streams）
- **W4 末**：能发给朋友真机试

---

## 8. 成本模型

目标 **< ¥200/月**，按 DAU 100 / MAU 1000 测算。

| 项 | 成本 |
|---|---|
| Vercel Hobby | ¥0 |
| Supabase Free | ¥0（500MB DB + 1GB Storage + 5万 MAU） |
| 域名 | ¥0（测试期用 `*.vercel.app`） |
| 短信/微信授权 | ¥0（匿名登录） |
| Storage | ¥0（Supabase Free 足够） |
| **DeepSeek** | **¥50–150** |
| **合计** | **~¥60–150/月** |

**DeepSeek 细算**（`deepseek-chat`：输入 ¥1/M，输出 ¥2/M，缓存输入 ¥0.1/M）：
- 每日运势 ¥0.004/次
- 抽签解读 ¥0.003/次
- 解梦 ¥0.0045/次
- 八字解读 ¥0.007/次
- 普通对话 ¥0.002/轮

假设 100 DAU × 5 动作 × 30 天 = 15000 次 × 均价 ¥0.004 = **¥60/月**。缓存命中再省 30%。

**超预算信号**：
- 单用户单日 > 100 次调用 → 限流生效
- 某 prompt 输出 > 3000 tokens → 压缩 system prompt

---

## 9. 风险 + 缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| lunar-javascript 真太阳时对不上 | 中 | 高（八字全错） | W1 单测跑 3 个手工验证案例 |
| 微信浏览器 SSE 被缓冲 | 高 | 中（流式差） | W2 末真机测；备选 `Transfer-Encoding: chunked` + fetch ReadableStream |
| DeepSeek 限流/宕机 | 低 | 高 | AI Gateway 3 秒超时 + 友好 fallback；备选 Kimi / 百炼 |
| 运势评分公式"太假"被察觉 | 中 | 中 | AI 解读含糊化、弱化分数、强化感受；规则引擎到位后替换 |
| 100 支签文字有瑕疵 | 高 | 低 | seed 后通读一遍修错字；AI 解读再润色 |
| 1 人精力枯竭 | **高** | **极高** | 每周五 review：没做完先砍特性，不加班 |

---

## 10. 上线后 2 周必做

1. **埋点**：关键漏斗（打开 → 填档案 → 首次对话 → 追问）
2. **反馈入口**：个人页加"吐槽"按钮，收集到 Supabase 表，每周扫一次
3. **Prompt 调优**：观察 `messages.content` 实际 AI 输出，改 `prompts` 表里的 system prompt（零发版）

---

## 11. V1.1 回补清单

按优先级从高到低：

1. 八字规则引擎对接（等 PRD 到）— 替换 `scorer.ts`
2. 多档案切换 UI（数据模型已支持）
3. 微信授权登录 + 手机号绑定/换绑
4. 周/月运势详情
5. 精准解梦表单（4 字段）
6. 梅花易数测算（爬 buyiju.com + 64 卦数据 + 算法）
7. 每日运势定时推送
8. 语音输入（ASR）
9. 会员/解锁未来运势
10. 塔罗牌
11. 自定义域名 + ICP 备案 + Cloudflare 前置

---

## 12. 下一步

本 spec 确认后，进入 `writing-plans` 阶段：把 W1–W5 拆成可执行任务列表，标注依赖关系，估点到半天粒度。
