# 轻运 AI · 文档对齐重构设计（V1.0）

> **背景**：现有实现与 `轻运AI需求文档(1).docx` 在业务流程和 UI 上有 9 处关键偏差。本文是 W1–W2 阶段的"对齐文档"重构设计，落地后业务流程 100% 符合需求文档章节 1–6（W3+ 处理重要 / 延后项）。
>
> **决策日期**：2026-04-26
> **范围**：W1–W2 核心 6 项（首页 4 入口 / chat 对话流 / 解梦快慢分支 / 测算对话化 / 八字简化表单 / 维度归一化）
> **W3+ 范围**：抽签扩量、运势日/周/月、多档案 + 微信 + 手机绑定（独立设计）

---

## 1. 整体架构变化

### 1.1 现状（当前实现）

每个 intent 一个独立"功能页"——`DivinationLauncher` / `DreamLauncher` / `BaziLauncher` / `MeihuaInputCard` 直接替换底部 `ChatInput`。本质是表单页伪装成 chat。

**问题**：违反文档"AI 问答 = 中央交互枢纽"的核心约定。文档（章节 2）明确要求底部固定 4 chip + 输入框 + 🎤 + ➕；所有意图引导都嵌在对话气泡流中。

### 1.2 新架构

```
┌──────────────────────────────────────────┐
│ AppHeader: ☰ 历史 / [创建新对话]            │
├──────────────────────────────────────────┤
│                                          │
│  消息流（虚拟列表）:                          │
│   - text bubble                           │
│   - choice card (引导选项)                  │
│   - form card (表单嵌入)                    │
│   - result card (签文/卦象/八字/解梦/运势)    │
│                                          │
├──────────────────────────────────────────┤
│ chip: [抽灵签] [测算] [AI解梦] [八字解读]    │
│ [输入框]                          [🎤] [➕] │
└──────────────────────────────────────────┘
```

**核心约束**：
- `ChatInput` 永远在底部，永远不被替换
- 4 个 chip 永远在 `ChatInput` 上方
- 4 个 launcher 组件全部废弃
- 所有意图引导都是 message 流里的卡片

### 1.3 用户进入路径

1. **首页快捷入口**：点 4 个入口卡 → `router.push('/chat?initial=我要抽灵签')` → ChatWindow 自动发送固定话术 → AI 识别意图 → 渲染引导卡
2. **自由打字**：在任意会话直接打字"我做了个奇怪的梦" → 服务端关键词命中 / LLM 兜底分类 → 走解梦流程
3. **底部 chip**：同 1，固定话术发送

---

## 2. 数据 schema 变化

### 2.1 `messages.metadata` 14 种 ui 类型

`metadata` 是已有 JSON 字段。新增 `ui` discriminator 字段：

```ts
type MessageUi =
  // 基础
  | 'text'                      // 普通文字（默认，metadata 可空）
  | 'intent_pending'            // AI 正在识别意图（loading 占位）

  // 引导卡（ChoiceCard 通用组件）
  | 'dream_choice'              // 快速 / 精准
  | 'slip_type_picker'          // 6 类签主题
  | 'meihua_method_picker'      // 时间 / 数字（V1 暂保留，UI 流程默认数字）

  // 表单卡（FormCard 通用组件）
  | 'dream_precise_form'        // 4 字段抽屉
  | 'bazi_quick_form'           // 性别 / 出生时间 / 出生地 简化
  | 'meihua_number_input'       // 3 个 1-9 数字

  // 结果卡（4 个独立组件）
  | 'slip_image'                // Canvas 合成签图 + 解读 + 保存
  | 'bazi_result'               // 八字解读
  | 'dream_result'              // 解梦解读
  | 'meihua_result'             // 卦象解读
  | 'fortune_result';           // 运势卡（chat 内追问运势时复用）
```

### 2.2 `conversations` 表 ALTER

```sql
ALTER TABLE conversations
  ADD COLUMN summary TEXT,
  ADD COLUMN summary_msg_count INTEGER DEFAULT 0,
  ADD COLUMN last_intent VARCHAR(20);
```

- `summary`：超过 K=6 轮的旧消息被压缩成的一句话摘要
- `summary_msg_count`：摘要覆盖的 message 数（用于决定下次摘要触发）
- `last_intent`：当前会话主导意图，用于 chip 高亮 / 引导卡复现

### 2.3 `profiles` 表 ALTER（如未存在）

```sql
ALTER TABLE profiles
  ADD COLUMN current_location VARCHAR(100);   -- 现居地（章节 1 个人档案）
```

如 `profiles.current_location` 已存在则跳过。

### 2.4 维度归一化（无迁移，全清重建）

数据策略：**`pnpm db:reset` + 重新 seed**，不写"旧 key → 新 key"迁移脚本。

新维度（统一到抽签 6 类）：

| 旧 key（要弃） | 新 key（统一） |
|---|---|
| 综合 | 综合运势 |
| 事业 | 事业学业 |
| 财运 | 财运（不变） |
| 感情 | 感情姻缘 |
| 人际 | 人际贵人 |
| 健康 | 平安健康 |
| 学业 | 合并进 事业学业 |

涉及文件：
- `lib/fortune/scorer.ts` 直接按新 6 维度写
- `lib/divination/slips.ts` 同上
- `db/seed/slips-v2.ts` 100 支签数据（替换 30 支版）
- AI prompt 模板（system prompt 里出现的维度名）

### 2.5 100 支签 seed 全量重写

文档章节 3.1.3 已经把 100 支签全部列好（签号 / 等级 / 签题 / 签诗 / 6 维度解读）。

操作：
1. 从 `轻运AI需求文档(1).docx` 提取 100 条数据 → `db/seed/slips-v2.ts`
2. 删除旧 `db/seed/slips.ts`（30 支版）
3. `pnpm db:reset` 触发 migrate + seed 重建

### 2.6 8 属性扩展

```ts
type FortuneAttributes = {
  color:     { name: string; hex: string };  // 幸运色
  direction: string;                          // 幸运方位
  hour:      { branch: string; range: string }; // 幸运时辰
  number:    number;                          // 幸运数
  flower:    string;                          // 幸运花
  item:      string;                          // 幸运随身物
  accessory: string;                          // 配饰（新增）
  food:      string;                          // 幸运食物（新增）
};
```

V1 计算规则（简化版）：按 day pillar 五行查表 → 配饰 / 食物。例：

| 五行 | 配饰 | 食物 |
|---|---|---|
| 金 | 银饰 / 白玉 | 白色食物（杏仁、银耳） |
| 木 | 玉镯 / 木珠 | 绿叶蔬菜 |
| 水 | 黑曜石 / 珍珠 | 黑色食物（黑米、紫菜） |
| 火 | 红玛瑙 / 红绳 | 红色食物（红枣、樱桃） |
| 土 | 黄水晶 / 陶饰 | 黄色食物（南瓜、玉米） |

完整算法待文档"后续给出"，V1 用此简化版。

---

## 3. API 变化

### 3.1 `/api/chat`（POST，SSE）—— 主战场

**body**：
```ts
{ conversationId?: string | null; text: string; }
```

不再接受 `intentHint`——服务端自己识别。

**新流程**：

```
1. 校验 + ensureUserId + checkRateLimit
2. classifyIntent(text)  →  { intent, confidence, source }
3. 写入 user message
4. 根据 intent 分流：
   - chat       → multi-turn 拼上下文 + 流式回复
   - divination → 写入 slip_type_picker 引导卡 message，结束（不调 AI）
   - dream      → 写入 dream_choice 引导卡 message，结束
   - bazi       → 检查 profile，已有则直接走解读流程；
                  未建档则写入 bazi_quick_form 表单卡 message
   - meihua     → 写入 meihua_number_input 表单卡 message（含 AI 文本 "好的，请把您想测算的事情详细描述出来..."）
5. SSE meta event 返回 conversationId + intent
6. chat 分支额外流式 token；其他分支直接 done
7. 异步触发摘要器（条件满足时）
```

### 3.2 `/api/intent/classify`（内部 POST）

```ts
input:  { text: string }
output: { intent: 'chat' | 'divination' | 'dream' | 'bazi' | 'meihua';
          confidence: number;
          source: 'keyword' | 'llm' }
```

**实现**：
1. 关键词层（`lib/ai/intent.ts` 现有）—— 命中直接返回 source='keyword'
2. 没命中 → 调廉价 LLM（`deepseek-chat`），system prompt 让它返回 5 类标签之一
3. LLM 失败 fallback 到 'chat'

不暴露给前端，`/api/chat` 内部调。

**测试**：30+ 自然句单测覆盖（包括文档章节 3-6 给的所有举例）。

### 3.3 `/api/divination/qianwen`（POST）—— sub-action 化

**body**：
```ts
{ conversationId: string; dimension: SlipDimension; userQuestion: string }
```

`dimension` 是 6 类之一：综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康。

**触发**：用户在 `slip_type_picker` 卡片上点某个维度。

**响应**：
1. 摇签 + pickSlip
2. 写 user 消息（"我要抽签 · 事业学业 · 用户问题文本"）
3. 写 assistant 消息（`slip_image` ui 类型，metadata 含签号 / 签题 / 签诗 / 6 维度解读 / 主选维度 reading）
4. 触发 AI 解读流式输出（写到第 3 条消息，ui=text 或 slip_reading）

### 3.4 `/api/divination/dream`（POST）—— sub-action 化

**body**：
```ts
{ conversationId: string;
  mode: 'fast' | 'precise';
  payload: {
    // mode='fast': dreamText + emotion?
    // mode='precise': core, emotion, reality?, special?
    [key: string]: string | undefined;
  };
}
```

**响应**：
1. 写 user 消息（描述梦境内容）
2. AI 解读（按文档章节 4 模板，6 段结构）
3. 写 assistant 消息（`dream_result` ui 类型）

### 3.5 `/api/divination/bazi`（POST）—— sub-action 化

**body**：
```ts
{ conversationId: string;
  focus: BaziFocus;        // 综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康
  userQuestion: string;
  profileSnapshot?: {       // 对话内简化表单提交时携带
    gender: 'male' | 'female';
    birth_time: string;     // ISO with +08:00
    birth_province: string;
    birth_city: string;
    birth_district?: string;
    longitude: number;
    latitude: number;
  };
}
```

如 `profileSnapshot` 存在 → 用它排盘；否则取 user 现有 profile。

**响应**：写 user + assistant 消息（`bazi_result`）+ AI 解读流式。

### 3.6 `/api/divination/meihua`（POST）—— 简化

V1 路径只走数字测算（移除"meihua_method_picker"实际选择步骤，UI 上保留 chip 但默认引导走数字）。

**body**：
```ts
{ conversationId: string; numbers: number[]; userQuestion: string }
```

数字 1-9，1-3 个。

**响应**：起卦 + AI 解读 → `meihua_result` 消息。

外应回填（PATCH）保留现有实现，不在 W1-W2 范围。

### 3.7 `/api/conversations/[id]` PATCH —— 重命名

```ts
PATCH /api/conversations/:id   body: { title: string }
```

文档章节 2.3 历史抽屉支持长按 / 滑动 → 删除 / 重命名。删除已有，重命名新增。

`title` 长度限制 20 字。

---

## 4. 页面变化

### 4.1 `/`（首页）—— 大改

按文档 image2 mockup 重做：

```
顶: 👤 昵称 ⇌                          →
    （⇌ 切换档案 W5+ 阶段实装，先占位）

    轻运分数  80分
    [综合运势] [事业学业] [财运] [感情姻缘] [人际贵人] [平安健康]
       80         80       80       80         80         80

    对运势进行解读 一句话总评

    [幸运色] [配饰] [幸运时辰] [幸运方位]
    [幸运数] [幸运食物] [幸运随身物] [幸运花]
    （8 属性 grid 2x4）

    ┌──────────────┐ ┌──────────────┐
    │ 抽灵签   →    │ │ 测算    →    │
    │ 心有迷茫       │ │ 事有两难      │
    │ 一签解惑       │ │ 一算了然      │
    └──────────────┘ └──────────────┘
    ┌──────────────────────────────────┐
    │ AI 解梦  →                        │
    │ 梦有深意 一语点破                   │
    └──────────────────────────────────┘
    ┌──────────────────────────────────┐
    │ AI 八字解读  →                     │
    │ 运有起落 一语知途                   │
    └──────────────────────────────────┘

底: [首页] [AI问答] [我的]
```

**4 入口卡核心动作**：点击 → `router.push('/chat?initial=' + encodeURIComponent('我要抽灵签'))` → ChatWindow 自动发送 + AI 识别意图 + 渲染引导卡。

### 4.2 `/chat` —— 路由合并

文档没有"招呼页"概念。把 `/chat`（招呼页）和 `/chat/[sessionId]`（会话页）合并：

- 没参数 → 显示空对话状态（顶部 4 chip + 欢迎语）
- 有 `?cid=xxx` → 加载该会话历史
- 有 `?initial=xxx` → 自动发送固定话术（首页快捷入口跳过来）

URL 改造：`/chat/[sessionId]` 路由删除，统一 `/chat?cid=...&initial=...`。

`HistoryDrawer` 里点击会话 → `router.push('/chat?cid=' + id)`。

### 4.3 `/me` —— 小改

W1-W2 保持现状，但需要：
- 加"现居地"显示位置（onboarding 表单里也加）
- 编辑入口指向 `/onboarding?edit=1`（已有）

多档案 / 微信 / 手机绑定 是 W5+。

### 4.4 `/fortune/[date]` —— 仅维度命名归一化

W1-W2 阶段只把维度命名归一化（事业 → 事业学业 等）。日 / 周 / 月切换、子维度【深入追问】是 W3+。

### 4.5 `/onboarding` —— 微调

加"现居地"字段（同出生地用 RegionPicker），可选填。

### 4.6 删除路由

- `/chat/[sessionId]/page.tsx` 删除（路由合并到 `/chat`）
- `app/(demo)/*` 保留（demo 页不影响生产）

---

## 5. 新 / 改组件

### 5.1 通用引导组件 `<ChoiceCard>`（新）

```tsx
interface ChoiceCardProps {
  title: string;
  options: { key: string; label: string; hint?: string; icon?: React.ReactNode }[];
  onPick: (key: string) => void;
  busy?: boolean;
}
```

复用：`dream_choice` / `slip_type_picker`（6 主题改成 6 选项）/ `meihua_method_picker`。

### 5.2 通用表单组件 `<FormCard>`（新）

```tsx
interface FormCardProps {
  title: string;
  fields: FormField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => void;
  busy?: boolean;
}

interface FormField {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'select' | 'date' | 'region' | 'number';
  required?: boolean;
  max?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];  // type='select'
  min?: number; maxValue?: number;               // type='number'
}
```

复用：`dream_precise_form` / `bazi_quick_form` / `meihua_number_input`。

### 5.3 4 个结果卡

| 组件 | 现状 | 改动 |
|---|---|---|
| `<SlipImageCard>` | 现 SlipResultCard 是水彩文本卡 | **重写**：`<img src="/api/divination/slip-image/[n]"/>` + 立即解读 / 保存按钮 |
| `<MeihuaResultCard>` | 已有 4 宫格 | 微调：嵌入 message bubble 时减少留白 |
| `<BaziResultCard>` | 没有 | **新增**：把 day pillar / 五行 / 十神 抽到结构化区，下方 AI 文本 |
| `<DreamResultCard>` | 没有 | **新增**：6 段结构（共情 / 周公 / 弗洛伊德 / 荣格 / 节点提示 / 寄语）按文档模板分段渲染 |

### 5.4 重做 `<MessageBubble>` 分发

按 `metadata.ui` switch 14 种类型分发到对应组件。回调 `onPick(key)` / `onSubmit(values)` 由 ChatWindow 统一处理 → POST 到对应 sub-action API。

### 5.5 顶部 chip `<IntentChips>`（新）

底部 ChatInput 上方，永远 4 chip：抽灵签 / 测算 / AI 解梦 / 八字解读。点击 → 自动发送固定话术：

| chip | 话术 |
|---|---|
| 抽灵签 | 我要抽灵签 |
| 测算 | 我要测算 |
| AI 解梦 | 我要 AI 解梦 |
| 八字解读 | 我要八字解读 |

### 5.6 删除组件

- `app/chat/_components/DivinationLauncher.tsx`
- `app/chat/_components/DreamLauncher.tsx`
- `app/chat/_components/BaziLauncher.tsx`
- `app/chat/_components/MeihuaInputCard.tsx`
- `app/chat/_components/MeihuaWaiyingForm.tsx`（外应回填功能保留 PATCH，UI 改造延后）
- `app/chat/_components/QuickActions.tsx`（招呼页删了）
- `components/divination/SlipResultCard.tsx`（被 SlipImageCard 取代）

---

## 6. 签文图片 Canvas 服务端渲染

### 6.1 底图

1 张木牌 / 笺纸样式背景 PNG（约 750×1000 px @2x），灰白底 + 顶部签号槽 + 中部签题区 + 下部签诗区。

**生成方式（已确认）**：AI 文生图占位（DALL-E / 即梦 / Midjourney 任一）+ 后续美工优化不影响代码。

**Prompt 参考**（写实国学风）：
```
A vertical traditional Chinese fortune slip wooden tablet, beige rice paper texture
background, light ink-wash watercolor border with plum blossom motifs at corners,
center is empty space for calligraphy, top has a circular cartouche for slip number,
soft natural lighting, minimalist, no text, no characters, 750x1000 portrait,
warm cream tones, subtle pink and lavender accents
```

文件位置：`public/images/slip-bg.png`。开发期我用 AI 生成 1 张占位先跑通流程，后续可换正式美术稿（同名替换不影响代码）。

### 6.2 字体

- 思源宋体 `Noto Serif SC`（已用，layout.tsx 导入）
- 手写体 `Ma Shan Zheng / 马善政体`（Google Fonts），下载本地 → `public/fonts/ma-shan-zheng.ttf`

### 6.3 实现

```ts
// app/api/divination/slip-image/[n]/route.ts
import { createCanvas, loadImage, registerFont } from "canvas";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { divinationSlips } from "@/lib/db/schema";

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  registerFont("public/fonts/ma-shan-zheng.ttf", { family: "Ma Shan Zheng" });
  fontsRegistered = true;
}

export async function GET(_: Request, { params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1 || num > 100) {
    return new Response("invalid slip number", { status: 400 });
  }

  ensureFonts();
  const db = getDb();
  const [slip] = await db.select().from(divinationSlips).where(eq(divinationSlips.number, num)).limit(1);
  if (!slip) return new Response("not found", { status: 404 });

  const bg = await loadImage("public/images/slip-bg.png");
  const c = createCanvas(750, 1000);
  const ctx = c.getContext("2d");
  ctx.drawImage(bg, 0, 0, 750, 1000);

  // 签号 + 等级
  ctx.font = '40px "Ma Shan Zheng"';
  ctx.fillStyle = "#3a2a4a";
  ctx.textAlign = "center";
  ctx.fillText(`第 ${slip.number} 签 · ${slip.level}`, 375, 150);

  // 签题
  ctx.font = '60px "Noto Serif SC"';
  ctx.fillText(slip.title, 375, 320);

  // 签诗（自动 wrap）
  ctx.font = '32px "Noto Serif SC"';
  wrapText(ctx, slip.poem, 375, 500, 600, 50);

  return new Response(c.toBuffer("image/png"), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
```

### 6.4 缓存

服务端首次访问后把 PNG 缓存到 `data/slip-cache/{n}.png`（ persistent volume），后续请求 `fs.existsSync` 命中直接返回，不重渲染。

### 6.5 Docker 依赖

`canvas` npm 依赖 cairo / pango native lib。Dockerfile 加：

```dockerfile
RUN apk add --no-cache cairo cairo-dev pango pango-dev jpeg-dev giflib-dev pixman-dev
```

或 builder + runner 都加。

### 6.6 保存到相册

客户端 `<SlipImageCard>` 提供"保存"按钮：

```tsx
<a href={`/api/divination/slip-image/${slipNumber}`} download={`轻运灵签-${slipNumber}.png`}>
  保存
</a>
```

iOS Safari 限制：通过 `<a download>` 下载后 user 仍要"长按图片→存储到照片"。UI 上加一行小字提示。

---

## 7. 对话上下文 / 摘要器（multi-turn memory）

### 7.1 触发条件

每次 chat route 写入新 message 后，**异步**（不阻塞 SSE）检查：

```ts
const shouldSummarize =
  totalMessages >= 12 &&
  (totalMessages - lastSummaryMsgCount) >= 4;
```

### 7.2 摘要器 `lib/ai/summarizer.ts`

```ts
const K_RECENT = 6;
const SUMMARIZER_PROMPT = `你是对话摘要助手。用 80 字以内中文，总结这段对话的关键事实和未决问题。
忽略寒暄。重点保留：用户的问题、AI 的核心建议、提到的人 / 事 / 时间。`;

export async function summarize(conversationId: string) {
  const allMsgs = await db.select(...).from(messages)
    .where(eq(messages.conversation_id, conversationId))
    .orderBy(asc(messages.created_at));

  if (allMsgs.length < 12) return;

  const cutoff = allMsgs.length - K_RECENT;
  const oldMsgs = allMsgs.slice(0, cutoff);
  const transcript = oldMsgs.map(m => `${m.role}: ${m.content}`).join("\n");

  const ai = await chat({
    systemPrompt: SUMMARIZER_PROMPT,
    messages: [{ role: "user", content: transcript }],
    stream: false,
    model: "deepseek-chat",  // 便宜模型
  });

  await db.update(conversations)
    .set({ summary: ai.text, summary_msg_count: cutoff })
    .where(eq(conversations.id, conversationId));
}
```

### 7.3 chat route 拼上下文

```ts
async function buildPromptMessages(convId: string, userText: string): Promise<ChatMessage[]> {
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  const recent = await db.select().from(messages)
    .where(eq(messages.conversation_id, convId))
    .orderBy(desc(messages.created_at))
    .limit(K_RECENT);

  const msgs: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  if (conv?.summary) {
    msgs.push({ role: "system", content: `[此前对话摘要]\n${conv.summary}` });
  }
  for (const m of recent.reverse()) {
    msgs.push({ role: m.role as ChatRole, content: m.content });
  }
  msgs.push({ role: "user", content: userText });
  return msgs;
}
```

### 7.4 容错

- 摘要失败：`console.error` 但不抛错，下次写入触发条件再重试
- 摘要器调用用便宜模型（`deepseek-chat`），单次成本 ¥0.001 量级
- 摘要器 timeout 5s，超时跳过

### 7.5 测试

- 单测 `summarize()` 拼 transcript + 调用 chat({ stream: false }) + 写库
- 单测 `buildPromptMessages()` 在 summary 为空 / 非空、不同 message 数量下的行为
- 集成测：发 15 条消息后 `conversations.summary` 非空且 `summary_msg_count >= 6`

---

## 8. W1–W2 任务概览

| # | 任务 | 工作量 | 依赖 |
|---|---|---|---|
| 1 | schema：ALTER conversations 加 summary/summary_msg_count/last_intent；ALTER profiles 加 current_location；新建 6 维度版 lib/fortune/scorer + lib/divination/slips（不写迁移脚本，全清重建） | 0.2 天 | — |
| 2 | 100 支签 seed 全量替换 → `db/seed/slips-v2.ts`（覆盖旧 30 支） | 0.5 天 | 1 |
| 3 | `/api/intent/classify`（关键词层 + LLM 兜底）+ 30+ 自然句单测 | 1 天 | — |
| 4 | `/api/chat` 重做：multi-turn memory + intent 分流 + 引导卡输出 | 1 天 | 1, 3 |
| 5 | 摘要器 `lib/ai/summarizer.ts` + 异步触发 + 单测 | 0.5 天 | 4 |
| 6 | 4 个 sub-action API 重构（qianwen / dream / bazi / meihua）| 1.5 天 | 4 |
| 7 | 通用组件 `<ChoiceCard>` `<FormCard>` + ChatWindow 重构 + MessageBubble 14 种 ui 分发 | 1.5 天 | — |
| 8 | 8 属性扩展：`lib/fortune/attributes.ts` 加 accessory / food + V1 五行查表规则 | 0.5 天 | 1 |
| 9 | 首页 4 入口卡片 + 6 柱图（按 image2 mockup）+ 8 属性 grid | 1 天 | 8 |
| 10 | 路由合并：`/chat?cid=xxx` 取代 `/chat/[sessionId]`，删旧路由 + HistoryDrawer 跳转改 query string | 0.5 天 | 7 |
| 11 | 签文图片 Canvas 服务端渲染：底图 + 字体 + `/api/divination/slip-image/[n]` + Dockerfile 加 cairo 依赖 | 1 天 | 2 |
| 12 | `<SlipImageCard>` `<BaziResultCard>` `<DreamResultCard>` 3 个新结果卡 + MeihuaResultCard 微调 | 1 天 | 7, 11 |
| 13 | 顶部 chip `<IntentChips>` + 固定话术发送 | 0.5 天 | 7 |
| 14 | 解梦快速 / 精准对话流闭环（含精准 4 字段表单交互）+ E2E 烟测 | 0.5 天 | 4, 6, 7 |
| 15 | 八字"对话内简化表单"代替 412（已建档自动注入）+ E2E 烟测 | 0.5 天 | 4, 6, 7 |
| 16 | 测算对话流（描述事情 → 3 数字 → 解读）+ 删 meihua_method_picker 路径 | 0.5 天 | 4, 6, 7 |
| 17 | 现居地字段加到 onboarding + me 页 + schema | 0.5 天 | 1 |
| 18 | 重命名会话 PATCH API + HistoryDrawer 长按交互 | 0.5 天 | — |
| 19 | 集成测试（vitest）+ Playwright E2E 主流程烟测 | 1 天 | 全部 |
| **总计** | | **~12.5 天** | |

**排期决策（已确认）**：W1–W2 段实际需要 12.5 天 > 8 工作日，超 4.5 天。

**采用方案**：把原 W3-W4 段（重要：抽签扩量、运势日 / 周 / 月、子维度追问、卜易居 64 卦数据）合并为 **W3-W4-W5（共 12 工作日）**。本"对齐重构"段实际占 W1-W2 + W3 前半（约 12-13 个工作日），剩余 W3 后半 + W4 + W5（共约 12 工作日）做原 W3-W4 范围。

调整后整体节奏：

| 阶段 | 工作日 | 范围 |
|---|---|---|
| W1–W2 + W3 前半 | 12-13 天 | 本对齐重构 spec（核心 6 项） |
| W3 后半 + W4-W5 | 12 天 | 原"重要"项（抽签扩量、运势日 / 周 / 月、追问、64 卦） |
| W5+（独立排期） | 不固定 | 多档案 / 微信 / 手机绑定（依赖外部资源） |

排期决策不影响本设计的技术内容。

---

## 9. 测试 / 验收

### 9.1 单元测试目标

- `lib/ai/intent.ts` 30+ 自然句覆盖（关键词 + LLM 兜底）
- `lib/ai/summarizer.ts` 摘要器主路径 + 错误路径
- `lib/fortune/scorer.ts` 6 维度计算 snapshot
- `lib/divination/slips.ts` 100 支签命中率 + readings 完整性
- `lib/fortune/attributes.ts` 8 属性五行查表

### 9.2 集成测试

- `/api/chat` SSE 主流程 + multi-turn memory（发 15 条后验证 summary 写入）
- `/api/intent/classify` 上述 30+ 句
- `/api/divination/qianwen` 提交 → 写 3 条 message（user / slip_image / AI 解读）
- `/api/divination/slip-image/[n]` 1-100 全部命中（含缓存）

### 9.3 E2E（Playwright，手动跑）

主流程烟测：
1. onboarding → 首页（看到 4 入口卡）
2. 点"抽灵签"卡 → /chat 自动发送 "我要抽灵签" → AI 识别 → 渲染 6 类签主题选择
3. 点"事业学业" → 输入问题 → 摇签 → slip_image 显示 → 点"立即解读" → AI 流式解读
4. 退出对话，回到首页
5. 点"AI 解梦" → 渲染 dream_choice → 选"精准解梦" → 4 字段表单 → 提交 → AI 解读
6. 点"八字解读"（无档案场景）→ 渲染 bazi_quick_form → 提交 → AI 解读
7. 点"测算" → AI 引导描述事情 → 输入 → AI 引导 3 数字 → 输入 → AI 解读
8. 历史抽屉 → 看 4 条会话 → 长按某条 → 重命名为"事业测算" → 验证生效

### 9.4 验收清单（功能层面）

- ✅ 首页 4 入口卡片完全按 image2 渲染，文案与文档一致
- ✅ chat 页底部固定 4 chip + 输入框（不再被 launcher 替换）
- ✅ 解梦支持快速 / 精准两个分支
- ✅ 测算流程是纯对话（无独立 launcher）
- ✅ 八字未建档时弹简化表单卡（不再 412）
- ✅ 维度统一为 6 类（综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康）
- ✅ 签文图片 Canvas 渲染并可保存
- ✅ multi-turn 追问支持（验证连续问 5 轮上下文不丢）

---

## 10. 风险与依赖

| 风险 | 影响 | 缓解 |
|---|---|---|
| Docker `canvas` native 编译失败 | #11 签文图片 阻塞 | 备选：客户端 Canvas（已在 Section 6 描述） |
| 100 签 readings 抽取错误 | 抽签全部出错 | 单测 `divinationSlips` 全表完整性 |
| LLM 意图分类不准 | 意图分错走错流程 | 关键词层兜底 + confidence < 0.6 fallback chat |
| 摘要器超时影响 chat | 用户体验差 | 摘要异步、5s timeout |
| 服务器 wipe data 后丢失自测档案 | 测试需重建档 | 已确认接受 |
| 现有腾讯云数据库被清空 | 历史会话无 | V1 阶段无真实用户，已确认接受 |

---

## 11. 不在本设计范围

以下属于 W3+ 阶段，独立设计文档：

- 抽签摇签动画（W3 重要）
- 运势日 / 周 / 月切换 + 横向 7 天日历（W3 重要）
- 子维度【深入追问】按钮（W3 重要）
- 多档案管理（添加 / 切换）（W5+ 延后）
- 微信授权登录（W5+ 延后）
- 手机号绑定 / 换绑 + 验证码短信网关（W5+ 延后）
- 语音输入 ASR（V1 暂不做，文档要求 0.5/1s 延迟达标需要专业语音 SDK）
- 卜易居 64 卦数据爬取（W3 重要，与抽签扩量同期）
- 塔罗牌（V1.1，文档已标 P1）

---

**Spec 版本**：v1.0
**作者**：edy + Claude
**关联文档**：
- 需求文档：`/Users/edy/Downloads/轻运AI需求文档(1).docx`
- 现有 spec：`docs/superpowers/specs/2026-04-24-qingyun-ai-design.md`
- 现有 P1 / P2 实施计划（已部分落地）
