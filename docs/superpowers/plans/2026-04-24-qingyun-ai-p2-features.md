# 轻运 AI · P2 功能期（W3–W4）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 P1 骨架之上，完成 5 个功能闭环（抽签 M4 / 解梦 M5 / 首页运势 M2 / 八字解读 M6 / 梅花易数 M7 V1.0）的核心逻辑、Prompt、API、UI 静态件，为 P3 的 UI 联调和上线做好准备。W3 末梅花算法层通过朋友验收硬 gate。

**Architecture:** 计算 / 解读 分离：代码确定性产出结构化数据（签号、卦象、体用、应期、排盘等），AI 层读 `prompts` 表里 6 个模板做流式解读。所有占卜动作在同一个对话页分发，通过 `message.metadata.ui` 驱动前端渲染专用卡片（签文卡 / 4 宫格卦象卡）。梅花易数档 4 = 本/互/变/卦中卦 + 体用硬算 + 应期硬算 + 外应 AI 轻问。

**Tech Stack:** Next.js 15 App Router / Supabase (Postgres + Auth + RLS) / DeepSeek `deepseek-chat` / Vercel AI SDK `streamText` / lunar-javascript（时间起卦用）/ shadcn/ui + Tailwind / `iching` 或等价 npm 包（64 卦数据）/ Vitest / Playwright（集成）

**Plan 位置关系:**
- P1（骨架 · W1–W2）：Next.js 初始化、Supabase 建表/RLS/匿名登录、lunar-javascript 封装、档案 onboarding、AI Gateway、意图路由规则层、`/api/chat` SSE、对话页基础 UI
- **P2（功能期 · W3–W4 · 本计划）**
- P3（上线 · W5 + V1.0.5）：梅花 UI 联调、外应 AI 分支、打磨、PWA、真机测、埋点、Vercel 部署；随后 V1.0.5 补齐 3 种起卦方式

**前置假设（P1 Definition of Done，执行本计划前应满足）：**
- Supabase 已有表：`profiles`, `bazi_charts`, `fortunes`, `conversations`, `messages`, `divination_records`, `prompts`, `divination_slips`(空), `hexagrams`(空)
- RLS 策略已配，匿名登录可用
- `lib/bazi/chart.ts` 能根据 profile 算完整八字（干支/五行/十神/大运）
- `lib/ai/client.ts` 的 `chat()` 能流式调 DeepSeek，支持 token 统计
- 意图路由规则层 `lib/ai/intent.ts` 已有 `divination/dream/bazi/meihua/chat` 五类，梅花关键词已加入
- `/chat` 页面能来回对话，历史记录挂在 `conversations/messages`

---

## File Structure（本计划新增/修改的全部文件）

**新增：**
```
lib/
├── divination/
│   ├── slips.ts                              -- 100 签随机抽（已存在，可能需完善）
│   └── slips.test.ts
├── dream/
│   └── validator.ts                          -- 梦境内容校验（敏感词/长度）
├── fortune/
│   ├── scorer.ts                             -- 7 维度评分（可替换）
│   ├── scorer.test.ts
│   ├── attributes.ts                         -- 幸运色/方位/时辰
│   └── attributes.test.ts
└── meihua/
    ├── hexagram-data.ts                      -- 64 卦静态数据（从开源包导出）
    ├── wuxing.ts                             -- 五行生克规则
    ├── wuxing.test.ts
    ├── casting/
    │   ├── time-casting.ts
    │   ├── time-casting.test.ts
    │   ├── number-casting.ts
    │   ├── number-casting.test.ts
    │   ├── random-casting.ts                 -- V1.0.5 桩，V1.0 留空 export
    │   ├── stroke-casting.ts                 -- V1.0.5 桩
    │   └── coin-casting.ts                   -- V1.0.5 桩
    ├── derivation.ts                         -- 互卦/变卦/卦中卦
    ├── derivation.test.ts
    ├── ti-yong.ts                            -- 体用判断
    ├── ti-yong.test.ts
    ├── ying-qi.ts                            -- 应期推算（单文件可替换）
    ├── ying-qi.test.ts
    ├── index.ts                              -- castAndAnalyze() 集成入口
    └── index.test.ts

app/api/
├── divination/
│   ├── qianwen/route.ts                      -- 抽签
│   ├── dream/route.ts                        -- 解梦
│   ├── bazi/route.ts                         -- 八字解读
│   └── meihua/route.ts                       -- 梅花起卦 + 推演
└── fortune/daily/route.ts                    -- 首页运势（带缓存）

app/chat/_components/
├── SlipAnimation.tsx                         -- 摇签 Lottie
├── SlipResultCard.tsx                        -- 签文结果卡
├── MeihuaInputCard.tsx                       -- 梅花起卦选择器（V1.0 两种亮，其它灰占位）
└── MeihuaResultCard.tsx                      -- 梅花 4 宫格卦象卡

db/seed/
├── 100_slips.sql                             -- 从需求文档提取
├── 64_hexagrams.sql                          -- 从 npm 开源包导出
└── prompts.sql                               -- 6 个 prompt 初始版本

scripts/
└── export-hexagrams.ts                       -- 一次性脚本：npm 包 → SQL seed
```

**修改：**
```
app/
├── page.tsx                                  -- 首页：加运势渲染（Task D5/D6）
└── chat/[sessionId]/page.tsx                 -- 接入 SlipResultCard / MeihuaResultCard 渲染分支（Task A6/A7 + F4）
```

---

## 任务依赖图

```
[A. 抽签 M4]  ──┐
[B. 解梦 M5]  ──┼─ 互相独立, 可任意顺序或并行
                │
[C. 梅花算法层] ─┴─→ [W3 末硬 gate: 朋友 5 案例验收]
                          │
              ┌───────────┤
              │           ↓ (gate 通过)
              ↓       [F. 梅花 W4 部分]
         (gate 不过:     · meihua.interpret prompt
          触发 V1.0.1    · /api/divination/meihua
          降级，跳过 F)  · MeihuaInputCard / ResultCard

[D. 首页运势 M2]  ──┐
[E. 八字解读 M6]  ──┴─ 独立, 不受梅花 gate 影响
```

---

## 视觉系统 · 素笺仙气（沿用 P1 已建 token）

> **设计源**：`docs/superpowers/designs/prompts-all-pages.md`
>
> P1 Section S 已建设：tailwind token / Noto Serif SC + Noto Sans SC / mist 背景 / `<Sparkle> <GlassCard> <WatercolorDot> <Divider>` 仙气原子 / `<AppShell> <AppHeader> <BottomNav>` 共享布局。**P2 阶段所有 UI Task 必须套用以上原子，不再手写 hex 色或 backdrop-blur 自由组合。**
>
> 每个 UI Task 末尾增加"视觉走查（对照 §X）"步骤，差异 ≥80% 接近通过。

## P2 涉及的页面排期

| 页面 / 组件 | 设计 prompt | P2 任务 | 视觉走查归属 |
|---|---|---|---|
| Home `/` | §1 | D5（接数据）+ D6（DailyFortuneCard 出图）| D6 末步 |
| FortuneDetail `/fortune/[date]` | §11 | **D7（新增）** | D7 末步 |
| Chat Session 增强（嵌入 Slip / Meihua 卡）| §4 | A7（抽签接线）+ F4（梅花 ResultCard）| 各任务末步 |
| SlipResultCard | §7 | A6 | A6 末步 |
| BaziChart 卡 | §8 | E2 | E2 末步 |
| MeihuaInputCard | §5 | F3 | F3 末步 |
| MeihuaResultCard | §6（已定 mockup `a-refined-fairy.html`）| F4 | F4 末步（已对齐） |

---

## Section A — 抽签（M4）

### Task A1: 提取 100 支灵签 seed 到 SQL

**Files:**
- Create: `db/seed/100_slips.sql`
- Reference: 需求文档（`/Users/edy/Downloads/轻运AI需求文档.docx`）第 69–169 行

- [ ] **Step 1: 从需求文档提取 100 签数据**

打开需求文档，提取 100 支签的：`number`, `level`, `title`, `poem`, `readings{综合/事业/财运/感情/人际/健康}`。

- [ ] **Step 2: 写 seed SQL 文件**

`db/seed/100_slips.sql` 开头样例（先写前 3 支做示范，后面 97 支同结构）：

```sql
-- 轻运 AI · 100 支灵签 seed
-- 来源：需求文档 69–169 行

INSERT INTO divination_slips (number, level, title, poem, readings) VALUES
(1, '上上', '天官赐福', '灵签第一最为上，富贵荣华百事昌。若问求财皆遂意，更兼疾病保安康。', '{"综合":"大吉大利，诸事皆顺","事业":"得贵人提携，步步高升","财运":"正财偏财两旺","感情":"红鸾星动，良缘已至","人际":"四方贵人相助","健康":"百病不侵，精神焕发"}'),
(2, '上吉', '钟离成道', '⋯（签文）⋯', '{"综合":"⋯","事业":"⋯","财运":"⋯","感情":"⋯","人际":"⋯","健康":"⋯"}'),
(3, '吉',   '⋯',       '⋯',                   '{"综合":"⋯","事业":"⋯","财运":"⋯","感情":"⋯","人际":"⋯","健康":"⋯"}')
-- … 补满 100 行
;
```

- [ ] **Step 3: 导入本地 Supabase 验证行数**

Run: `psql $SUPABASE_DB_URL -f db/seed/100_slips.sql && psql $SUPABASE_DB_URL -c 'SELECT COUNT(*) FROM divination_slips;'`
Expected: `count = 100`

- [ ] **Step 4: 通读一遍校对错字**

肉眼扫一遍，改明显错字。AI 解读会再做一次文字润色，不追求完美。

- [ ] **Step 5: Commit**

```bash
git add db/seed/100_slips.sql
git commit -m "feat(divination): seed 100 灵签"
```

---

### Task A2: 落 `divination.qianwen` prompt 到 prompts 表

**Files:**
- Create: `db/seed/prompts.sql`（初版只含本 prompt，后续任务会 append 或重跑）

- [ ] **Step 1: 写 `divination.qianwen` prompt 到 seed SQL**

`db/seed/prompts.sql`：

```sql
INSERT INTO prompts (key, version, system_prompt, user_prompt_tpl, active) VALUES
('divination.qianwen', 1,
'你是一位亲切、年轻化的占卜师。用户刚抽到一支灵签，请结合签文和用户的具体问题，给出治愈向解读。

风格要求:
- 语言年轻化、温柔，像朋友聊天
- 严禁使用 "大凶/倒霉/厄运/不祥" 等负面词
- "慎行" 级签转化为 "善意提醒"
- 结尾必给可落地的建议

输出结构（共 3 段，每段 3-5 句）:
1. 签意理解（结合签号和签题）
2. 针对用户问题的具体解读（紧扣所选维度）
3. 下一步建议 + 温柔鼓励',
'签号: {number}  等级: {level}  签题: {title}
签文: {poem}
用户选的维度: {dimension}
用户的问题: {userQuestion}

请按 system 要求输出 3 段解读。',
true)
ON CONFLICT (key, version) DO UPDATE SET system_prompt = EXCLUDED.system_prompt, user_prompt_tpl = EXCLUDED.user_prompt_tpl, active = EXCLUDED.active;
```

- [ ] **Step 2: 导入验证**

Run: `psql $SUPABASE_DB_URL -f db/seed/prompts.sql && psql $SUPABASE_DB_URL -c "SELECT key, version, active FROM prompts WHERE key = 'divination.qianwen';"`
Expected: 返回 1 行 `divination.qianwen | 1 | t`

- [ ] **Step 3: Commit**

```bash
git add db/seed/prompts.sql
git commit -m "feat(ai): add divination.qianwen prompt v1"
```

---

### Task A3: `lib/divination/slips.ts` 随机抽签 + 单测

**Files:**
- Create: `lib/divination/slips.ts`
- Test: `lib/divination/slips.test.ts`

- [ ] **Step 1: 写失败测试**

`lib/divination/slips.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { pickSlip } from './slips';

describe('pickSlip', () => {
  it('returns a slip with number in [1, 100]', () => {
    const slip = pickSlip();
    expect(slip.number).toBeGreaterThanOrEqual(1);
    expect(slip.number).toBeLessThanOrEqual(100);
  });

  it('uses provided seed to produce deterministic output', () => {
    const a = pickSlip({ seed: 'user-abc-2026-04-24' });
    const b = pickSlip({ seed: 'user-abc-2026-04-24' });
    expect(a.number).toBe(b.number);
  });

  it('different seeds produce different slips (statistical, not guaranteed)', () => {
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      results.add(pickSlip({ seed: `seed-${i}` }).number);
    }
    expect(results.size).toBeGreaterThan(20); // 期望分散
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/divination/slips.test.ts`
Expected: FAIL（pickSlip 未导出）

- [ ] **Step 3: 实现**

`lib/divination/slips.ts`：

```ts
import { createHash } from 'crypto';

export interface SlipPick {
  number: number; // 1-100
}

export function pickSlip(opts?: { seed?: string }): SlipPick {
  if (opts?.seed) {
    const hash = createHash('sha256').update(opts.seed).digest();
    const n = hash.readUInt32BE(0) % 100 + 1;
    return { number: n };
  }
  return { number: Math.floor(Math.random() * 100) + 1 };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/divination/slips.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: Commit**

```bash
git add lib/divination/slips.ts lib/divination/slips.test.ts
git commit -m "feat(divination): add deterministic slip picker"
```

---

### Task A4: `/api/divination/qianwen` 路由（起签 + 分发到 /api/chat）

**Files:**
- Create: `app/api/divination/qianwen/route.ts`
- Test: 该路由只做起签 + 入库，不做流式；测试走手动 curl（见 Step 5）

- [ ] **Step 1: 写路由骨架**

`app/api/divination/qianwen/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { pickSlip } from '@/lib/divination/slips';

export async function POST(req: NextRequest) {
  const { conversationId, dimension, userQuestion } = await req.json();
  if (!conversationId || !dimension || !userQuestion) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 1. 抽签
  const { number } = pickSlip({ seed: `${user.id}-${Date.now()}` });

  // 2. 读签文
  const { data: slip, error: slipErr } = await supabase
    .from('divination_slips')
    .select('*')
    .eq('number', number)
    .single();
  if (slipErr || !slip) return NextResponse.json({ error: 'slip_not_found' }, { status: 500 });

  // 3. 写一条 assistant 消息 (metadata.ui = 'slip_result') + divination_records
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: `抽到第 ${slip.number} 签 · ${slip.level} · ${slip.title}`,
      intent: 'divination',
      metadata: { ui: 'slip_result', slip_number: slip.number },
    })
    .select()
    .single();
  if (msgErr || !message) return NextResponse.json({ error: 'message_insert_failed' }, { status: 500 });

  await supabase.from('divination_records').insert({
    message_id: message.id,
    type: 'qianwen',
    input: { dimension, userQuestion },
    result: { number: slip.number, level: slip.level, title: slip.title, poem: slip.poem, reading: slip.readings[dimension] },
  });

  // 4. 返回 slip 给前端渲染 Card；AI 解读由前端调 /api/chat 流式拉
  return NextResponse.json({ messageId: message.id, slip });
}
```

- [ ] **Step 2: 手动调用测试（本地）**

先 `pnpm dev`，然后登录建会话，拿到 conversationId，curl：

```bash
curl -X POST http://localhost:3000/api/divination/qianwen \
  -H "Content-Type: application/json" \
  -H "Cookie: $(grep sb-access /tmp/cookies.txt)" \
  -d '{"conversationId":"<your-id>","dimension":"事业","userQuestion":"最近换工作合适吗"}'
```

Expected: 返回 `{messageId, slip: {number, level, title, poem, readings}}`，Supabase 里 `messages` 和 `divination_records` 各多一行

- [ ] **Step 3: 加 error case 校验**

确认 400/401/500 分支符合预期（缺参数/未登录/签文查询失败分别返回对应码）。

- [ ] **Step 4: Commit**

```bash
git add app/api/divination/qianwen/route.ts
git commit -m "feat(api): POST /api/divination/qianwen — pick slip + persist"
```

---

### Task A5: `<SlipAnimation>` 摇签 Lottie 组件

**Files:**
- Create: `app/chat/_components/SlipAnimation.tsx`
- Asset: 放到 `public/lottie/slip-shake.json`（从 LottieFiles 找免费摇签动画）

- [ ] **Step 1: 下载/选定 Lottie JSON**

去 https://lottiefiles.com 搜 "shake / divination / dice"，挑一个 <100KB 的免费资产，存为 `public/lottie/slip-shake.json`。

- [ ] **Step 2: 写组件**

`app/chat/_components/SlipAnimation.tsx`：

```tsx
'use client';
import { useLottie } from 'lottie-react';
import animationData from '/public/lottie/slip-shake.json';

interface Props {
  onComplete?: () => void;
}

export function SlipAnimation({ onComplete }: Props) {
  const { View } = useLottie({
    animationData,
    loop: false,
    onComplete,
  });
  return <div className="w-32 h-32 mx-auto">{View}</div>;
}
```

- [ ] **Step 3: 装依赖**

Run: `pnpm add lottie-react`

- [ ] **Step 4: 手动检查渲染**

临时在 `/chat/page.tsx` 引用，确认动画能播完并触发 `onComplete`。

- [ ] **Step 5: Commit**

```bash
git add app/chat/_components/SlipAnimation.tsx public/lottie/slip-shake.json package.json pnpm-lock.yaml
git commit -m "feat(chat): add SlipAnimation Lottie component"
```

---

### Task A6: `<SlipResultCard>` 签文结果卡

**Files:**
- Create: `app/chat/_components/SlipResultCard.tsx`

- [ ] **Step 1: 写组件**

`app/chat/_components/SlipResultCard.tsx`：

```tsx
'use client';
import { cn } from '@/lib/utils';

interface Slip {
  number: number;
  level: '上上' | '上吉' | '吉' | '平' | '渐顺' | '慎行';
  title: string;
  poem: string;
}

const levelColor: Record<Slip['level'], string> = {
  上上: 'bg-red-50 text-red-700 border-red-200',
  上吉: 'bg-orange-50 text-orange-700 border-orange-200',
  吉:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  平:   'bg-gray-50 text-gray-700 border-gray-200',
  渐顺: 'bg-blue-50 text-blue-700 border-blue-200',
  慎行: 'bg-purple-50 text-purple-700 border-purple-200',
};

export function SlipResultCard({ slip }: { slip: Slip }) {
  return (
    <div className={cn('rounded-lg border p-4 my-2', levelColor[slip.level])}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">第 {slip.number} 签</span>
        <span className="px-2 py-0.5 rounded-full text-sm bg-white/60">{slip.level}</span>
      </div>
      <div className="text-xl mt-1 font-medium">{slip.title}</div>
      <pre className="font-serif whitespace-pre-wrap text-sm mt-3 opacity-80">{slip.poem}</pre>
    </div>
  );
}
```

- [ ] **Step 2: 在 MessageList 里按 metadata.ui 分发渲染**

修改 `app/chat/_components/MessageList.tsx`（应该已存在），加一个 switch：

```tsx
{message.metadata?.ui === 'slip_result' && message.metadata.slip_number && (
  <SlipResultCard slip={/* 从 divination_records 读，见 Task A7 */} />
)}
```

- [ ] **Step 3: 手动验证**

`pnpm dev` → 模拟 metadata.ui = 'slip_result' 的消息 → 看卡片样式

- [ ] **Step 4: 视觉走查（对照 §7 SlipResultCard）— 套素笺仙气重写**

把 Step 1 的 `<div className="rounded-lg border p-4">` 升级到设计文档 §7 的规约：

- [ ] 容器换成 `<GlassCard rounded="card" shadow="glass">`
- [ ] 签号 "第 八·十·六 签" 用 serif 15px 墨紫 `tracking-ritual2`，数字大字渲染（中文数字 or 大号阿拉伯）
- [ ] 等级 pill 按 6 档不同渐变（上上=warm rose / 上吉=peach / 吉=soft yellow / 平=neutral lavender / 渐顺=blue-purple / 慎行=muted mauve），不要刺眼红色
- [ ] 签题居中 serif 20px 墨紫 `tracking-ritual3`，两侧 ✦ 装饰
- [ ] 签文 4 行居中 serif 15px 墨紫 `tracking-ritual` `leading-[2.2]`，下方 lavender WatercolorDot 40% 模糊
- [ ] 6 维度 tabs（综合/事业/财运/感情/人际/健康）11px serif，active 下划线 lavender 2px
- [ ] 解读 sans 13px 墨紫 leading-[1.85]
- [ ] 中部用 `<Divider>` 含 ✦

差异 ≥80% 接近通过；截图归档到 `docs/superpowers/specs/visual-baseline/slip-result.png`。

- [ ] **Step 5: Commit**

```bash
git add app/chat/_components/SlipResultCard.tsx app/chat/_components/MessageList.tsx
git commit -m "feat(chat): SlipResultCard 素笺仙气版"
```

---

### Task A7: 抽签对话流接线（端到端）

**Files:**
- Modify: `app/chat/_components/ChatWindow.tsx`（已有，加分支）
- Modify: `app/chat/[sessionId]/page.tsx`

- [ ] **Step 1: 前端：检测意图 'divination' 后显示 6 个维度选项**

在对话页拦截 AI 回的第一条 `metadata.ui = 'options'` 消息，渲染 6 个主题按钮（综合/事业/财运/感情/人际/健康）。用户点击后，前端 hold 住维度，继续追问"你的问题是什么"。

- [ ] **Step 2: 用户描述问题后 → 前端先播 `<SlipAnimation>` 2s → 调 `/api/divination/qianwen`**

伪码：

```tsx
async function handleQianwenFlow(dimension: string, userQuestion: string) {
  setShowAnimation(true);
  await delay(2000);
  const { messageId, slip } = await fetch('/api/divination/qianwen', {
    method: 'POST',
    body: JSON.stringify({ conversationId, dimension, userQuestion }),
  }).then(r => r.json());
  setShowAnimation(false);
  // 签文卡片会通过 messages 订阅自动渲染
  // 立即追调 /api/chat 触发 AI 解读
  startChatStream({
    intent: 'divination.qianwen',
    refMessageId: messageId,
    variables: { number: slip.number, level: slip.level, title: slip.title, poem: slip.poem, dimension, userQuestion },
  });
}
```

- [ ] **Step 3: 改 `/api/chat` 支持 `intent` + `refMessageId` 参数**

（P1 应该已有 /api/chat，这里扩展）：当请求带 `intent = 'divination.qianwen'`，用 `prompts` 表里对应模板 + variables 渲染 user prompt，正常流式返回。

- [ ] **Step 4: 手动走完端到端**

从 `/chat` 输入 "我要抽灵签" → 选 "事业" → 输 "最近换工作合适吗" → 看动画 → 看卡片 → 看 AI 流式解读

- [ ] **Step 5: Commit**

```bash
git add app/chat/**/*.{ts,tsx} app/api/chat/route.ts
git commit -m "feat(chat): wire up 抽签 end-to-end flow"
```

---

## Section B — 解梦（M5）

### Task B1: 落 `dream.parse` prompt

**Files:**
- Modify: `db/seed/prompts.sql`

- [ ] **Step 1: append `dream.parse` INSERT**

在 `db/seed/prompts.sql` 末尾追加：

```sql
INSERT INTO prompts (key, version, system_prompt, user_prompt_tpl, active) VALUES
('dream.parse', 1,
'你是一位亲切的梦境顾问。用户描述了一个梦，请用三个视角综合解读。

风格要求:
- 语言温柔治愈，避免评判性语言
- 不许说 "凶兆 / 预示不祥 / 倒霉 " 等负面词
- 重点关注用户的感受和现实生活的呼应，少做宿命论

输出结构（3 段，每段 4-6 句）:
1. 【周公视角】传统梦境符号的传统含义
2. 【弗洛伊德视角】梦的情绪/欲望暗示
3. 【荣格视角】梦的原型意象、集体无意识
结尾 1 段温柔总结 + 可落地的行动建议（休息/沟通/记录等）',
'用户的梦: {dreamContent}
用户的情绪（可空）: {mood}
最近发生的相关事件（可空）: {recentEvents}

请按 system 要求输出三视角 + 总结。',
true)
ON CONFLICT (key, version) DO UPDATE SET system_prompt = EXCLUDED.system_prompt, user_prompt_tpl = EXCLUDED.user_prompt_tpl, active = EXCLUDED.active;
```

- [ ] **Step 2: 导入验证**

Run: `psql $SUPABASE_DB_URL -f db/seed/prompts.sql && psql $SUPABASE_DB_URL -c "SELECT key FROM prompts WHERE active = true;"`
Expected: 至少看到 `divination.qianwen` 和 `dream.parse` 两行

- [ ] **Step 3: Commit**

```bash
git add db/seed/prompts.sql
git commit -m "feat(ai): add dream.parse prompt v1"
```

---

### Task B2: `lib/dream/validator.ts` + 单测

**Files:**
- Create: `lib/dream/validator.ts`
- Test: `lib/dream/validator.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { validateDream } from './validator';

describe('validateDream', () => {
  it('rejects empty content', () => {
    expect(() => validateDream('')).toThrow('dream_empty');
  });
  it('rejects >1500 chars', () => {
    expect(() => validateDream('a'.repeat(1501))).toThrow('dream_too_long');
  });
  it('rejects sensitive keyword 自杀', () => {
    expect(() => validateDream('我梦到自杀')).toThrow('dream_sensitive');
  });
  it('accepts normal dream', () => {
    const ok = validateDream('我梦到自己在飞，感觉很开心');
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/dream/validator.test.ts`
Expected: FAIL（validateDream 未导出）

- [ ] **Step 3: 实现**

```ts
const SENSITIVE = ['自杀', '杀人', '强奸', '吸毒'];

export function validateDream(content: string): true {
  if (!content || content.trim().length === 0) throw new Error('dream_empty');
  if (content.length > 1500) throw new Error('dream_too_long');
  for (const k of SENSITIVE) if (content.includes(k)) throw new Error('dream_sensitive');
  return true;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/dream/validator.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add lib/dream/validator.ts lib/dream/validator.test.ts
git commit -m "feat(dream): validator with sensitive word filter"
```

---

### Task B3: `/api/divination/dream` + 对话流接线

**Files:**
- Create: `app/api/divination/dream/route.ts`
- Modify: `app/chat/_components/ChatWindow.tsx`

- [ ] **Step 1: 写 API 路由**

`app/api/divination/dream/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { validateDream } from '@/lib/dream/validator';

export async function POST(req: NextRequest) {
  const { conversationId, dreamContent, mood, recentEvents } = await req.json();
  if (!conversationId || !dreamContent) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  try {
    validateDream(dreamContent);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: message } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '正在解梦…',
      intent: 'dream',
      metadata: { ui: null },
    })
    .select()
    .single();
  if (!message) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  await supabase.from('divination_records').insert({
    message_id: message.id,
    type: 'dream',
    input: { dreamContent, mood: mood ?? null, recentEvents: recentEvents ?? null },
    result: {}, // 解梦没有结构化 result
  });

  return NextResponse.json({ messageId: message.id });
}
```

- [ ] **Step 2: 前端对话流**

意图识别到 'dream' → AI 说"把梦告诉我吧（越详细越好）"→ 用户输入 → 可选追问"当时心情怎么样？"→ 可选追问"最近有什么相关的事吗？"（两问都可跳过）→ 调 `/api/divination/dream` → 立即调 `/api/chat` 流式拉 `dream.parse` 解读

- [ ] **Step 3: 手动跑一遍**

从 `/chat` 输入"帮我解个梦" → 跟完整流程 → 看 3 段解读流式出来

- [ ] **Step 4: Commit**

```bash
git add app/api/divination/dream/route.ts app/chat/_components/ChatWindow.tsx
git commit -m "feat(dream): /api/divination/dream + chat flow"
```

---

## Section C — 梅花易数算法层（W3 重点）

### Task C1: 评估 + 选定 64 卦 npm 开源包

**Files:**
- Create: `scripts/export-hexagrams.ts`

- [ ] **Step 1: 列出 3 个候选包并装上检查**

候选：`iching`, `i-ching-npm`, `zhouyi`（实际 npm 搜索确认当前可用包名）

Run: `pnpm add -D iching && node -e "const p = require('iching'); console.log(Object.keys(p))"` 看 API；依次对 3 个包做同样检查。

评估标准：
1. 是否含 64 卦完整 name/judgment/image/lines（6 条爻辞）
2. 爻辞是否完整（不能只有初九没六二）
3. 是否含上下卦 trigram 信息（用于后面推演）
4. 有无 TypeScript 类型

- [ ] **Step 2: 选定一个，写 export 脚本**

假设选中 `iching`（以此包 API 为例），`scripts/export-hexagrams.ts`：

```ts
import * as iching from 'iching';
import { writeFileSync } from 'fs';

// 八卦序 -> 五行
const trigramWuxing: Record<string, string> = {
  乾: '金', 兑: '金', 离: '火', 震: '木',
  巽: '木', 坎: '水', 艮: '土', 坤: '土',
};

const rows: string[] = [];
for (let n = 1; n <= 64; n++) {
  const h = iching.getHexagram(n); // 根据实际 API 调整
  const line = `(${n}, '${h.name.replace(/'/g, "''")}', '${h.upperTrigram}', '${h.lowerTrigram}', '${trigramWuxing[h.upperTrigram]}', '${trigramWuxing[h.lowerTrigram]}', '${h.judgment.replace(/'/g, "''")}', '${h.image.replace(/'/g, "''")}', '${JSON.stringify(h.lines).replace(/'/g, "''")}'::jsonb)`;
  rows.push(line);
}

const sql = `-- 64 卦 seed，从 iching npm 包导出\n\nINSERT INTO hexagrams (number, name, upper_trigram, lower_trigram, upper_wuxing, lower_wuxing, judgment, image, lines) VALUES\n${rows.join(',\n')}\nON CONFLICT (number) DO UPDATE SET name = EXCLUDED.name, upper_trigram = EXCLUDED.upper_trigram, lower_trigram = EXCLUDED.lower_trigram, upper_wuxing = EXCLUDED.upper_wuxing, lower_wuxing = EXCLUDED.lower_wuxing, judgment = EXCLUDED.judgment, image = EXCLUDED.image, lines = EXCLUDED.lines;\n`;

writeFileSync('db/seed/64_hexagrams.sql', sql);
console.log('Wrote db/seed/64_hexagrams.sql');
```

- [ ] **Step 3: 运行脚本**

Run: `pnpm tsx scripts/export-hexagrams.ts`
Expected: 生成 `db/seed/64_hexagrams.sql`，文件行数 ≈ 70

- [ ] **Step 4: 降级分支（如 3 个包都不满意）**

若评估后 3 个包数据缺爻辞或结构乱：转 fallback D（手工从《周易本义》录入），此时 Task C1 延长半天；保留同样的 `db/seed/64_hexagrams.sql` 输出格式，只是数据来源换。

- [ ] **Step 5: Commit**

```bash
git add scripts/export-hexagrams.ts db/seed/64_hexagrams.sql package.json pnpm-lock.yaml
git commit -m "feat(meihua): export 64 hexagrams seed from npm package"
```

---

### Task C2: 导入 `hexagrams` seed + 抽查正确性

**Files:**
- Reference: `db/seed/64_hexagrams.sql`

- [ ] **Step 1: 导入**

Run: `psql $SUPABASE_DB_URL -f db/seed/64_hexagrams.sql && psql $SUPABASE_DB_URL -c 'SELECT COUNT(*) FROM hexagrams;'`
Expected: `count = 64`

- [ ] **Step 2: 抽查 5 个经典卦**

验证乾为天、坤为地、水天需、水火既济、山地剥：

Run:
```bash
psql $SUPABASE_DB_URL -c "SELECT number, name, upper_trigram, lower_trigram, upper_wuxing, lower_wuxing FROM hexagrams WHERE number IN (1, 2, 5, 63, 23);"
```
Expected:
- 1: 乾为天, 乾/乾, 金/金
- 2: 坤为地, 坤/坤, 土/土
- 5: 水天需, 坎/乾, 水/金
- 63: 水火既济, 坎/离, 水/火
- 23: 山地剥, 艮/坤, 土/土

若任何一行错 → 回 Task C1 Step 4（可能 npm 包有问题，切 fallback）

- [ ] **Step 3: 抽查爻辞完整性**

Run: `psql $SUPABASE_DB_URL -c "SELECT number, jsonb_array_length(lines) FROM hexagrams WHERE jsonb_array_length(lines) != 6;"`
Expected: 0 行（所有卦都有 6 条爻辞）

- [ ] **Step 4: Commit（数据导入无代码变更，跳过 commit）**

---

### Task C3: `lib/meihua/hexagram-data.ts` 类型 + 查询 helper

**Files:**
- Create: `lib/meihua/hexagram-data.ts`
- Test: `lib/meihua/hexagram-data.test.ts`

- [ ] **Step 1: 定义类型 + 写测试**

`lib/meihua/hexagram-data.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { findHexagramByTrigrams, TRIGRAMS } from './hexagram-data';

describe('hexagram-data', () => {
  it('TRIGRAMS has 8 entries', () => {
    expect(TRIGRAMS).toHaveLength(8);
  });
  it('finds 乾为天 from upper=乾, lower=乾', async () => {
    const h = await findHexagramByTrigrams('乾', '乾');
    expect(h.number).toBe(1);
    expect(h.name).toContain('乾');
  });
  it('finds 水天需 from upper=坎, lower=乾', async () => {
    const h = await findHexagramByTrigrams('坎', '乾');
    expect(h.number).toBe(5);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/hexagram-data.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/hexagram-data.ts`：

```ts
import { createServerClient } from '@/lib/supabase/server';

export type Trigram = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';
export const TRIGRAMS: Trigram[] = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

// 先天序: 乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
export const TRIGRAM_TO_NUM: Record<Trigram, number> = {
  乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8,
};
export const NUM_TO_TRIGRAM: Record<number, Trigram> = Object.fromEntries(
  Object.entries(TRIGRAM_TO_NUM).map(([k, v]) => [v, k])
) as any;

export type Wuxing = '金' | '木' | '水' | '火' | '土';
export const TRIGRAM_WUXING: Record<Trigram, Wuxing> = {
  乾: '金', 兑: '金', 离: '火', 震: '木',
  巽: '木', 坎: '水', 艮: '土', 坤: '土',
};

export interface Hexagram {
  number: number;
  name: string;
  upper_trigram: Trigram;
  lower_trigram: Trigram;
  upper_wuxing: Wuxing;
  lower_wuxing: Wuxing;
  judgment: string;
  image: string;
  lines: Array<{ position: string; text: string }>;
}

export async function findHexagramByTrigrams(upper: Trigram, lower: Trigram): Promise<Hexagram> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('hexagrams')
    .select('*')
    .eq('upper_trigram', upper)
    .eq('lower_trigram', lower)
    .single();
  if (error || !data) throw new Error(`hexagram_not_found: ${upper}/${lower}`);
  return data as Hexagram;
}

export async function findHexagramByNumber(num: number): Promise<Hexagram> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('hexagrams')
    .select('*')
    .eq('number', num)
    .single();
  if (error || !data) throw new Error(`hexagram_not_found: ${num}`);
  return data as Hexagram;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/hexagram-data.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: Commit**

```bash
git add lib/meihua/hexagram-data.ts lib/meihua/hexagram-data.test.ts
git commit -m "feat(meihua): hexagram data layer with trigram helpers"
```

---

### Task C4: `lib/meihua/wuxing.ts` 五行生克规则 + 单测

**Files:**
- Create: `lib/meihua/wuxing.ts`
- Test: `lib/meihua/wuxing.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { relation } from './wuxing';

describe('wuxing.relation', () => {
  it('金生水', () => expect(relation('金', '水')).toBe('sheng'));
  it('水生木', () => expect(relation('水', '木')).toBe('sheng'));
  it('木生火', () => expect(relation('木', '火')).toBe('sheng'));
  it('火生土', () => expect(relation('火', '土')).toBe('sheng'));
  it('土生金', () => expect(relation('土', '金')).toBe('sheng'));
  it('金克木', () => expect(relation('金', '木')).toBe('ke'));
  it('木克土', () => expect(relation('木', '土')).toBe('ke'));
  it('土克水', () => expect(relation('土', '水')).toBe('ke'));
  it('水克火', () => expect(relation('水', '火')).toBe('ke'));
  it('火克金', () => expect(relation('火', '金')).toBe('ke'));
  it('金金比和', () => expect(relation('金', '金')).toBe('he'));
  it('水生金 → 反向: 金不生水', () => expect(relation('水', '金')).not.toBe('sheng'));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/wuxing.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/wuxing.ts`：

```ts
import type { Wuxing } from './hexagram-data';

// 相生: 金→水→木→火→土→金
const SHENG: Record<Wuxing, Wuxing> = {
  金: '水', 水: '木', 木: '火', 火: '土', 土: '金',
};

// 相克: 金→木→土→水→火→金
const KE: Record<Wuxing, Wuxing> = {
  金: '木', 木: '土', 土: '水', 水: '火', 火: '金',
};

export type Relation = 'sheng' | 'ke' | 'he';

/** a → b 的关系：a 生 b / a 克 b / 比和 */
export function relation(a: Wuxing, b: Wuxing): Relation {
  if (a === b) return 'he';
  if (SHENG[a] === b) return 'sheng';
  if (KE[a] === b) return 'ke';
  // 反向（b 生 a 或 b 克 a）这里返回对 a 来讲是"被生"或"被克"
  if (SHENG[b] === a) return 'sheng'; // 注意：关系函数的使用方要自己考虑方向
  if (KE[b] === a) return 'ke';
  return 'he';
}

/** 更明确的有向关系 */
export type DirectedRelation = 'a_sheng_b' | 'b_sheng_a' | 'a_ke_b' | 'b_ke_a' | 'bi_he';
export function directedRelation(a: Wuxing, b: Wuxing): DirectedRelation {
  if (a === b) return 'bi_he';
  if (SHENG[a] === b) return 'a_sheng_b';
  if (SHENG[b] === a) return 'b_sheng_a';
  if (KE[a] === b) return 'a_ke_b';
  if (KE[b] === a) return 'b_ke_a';
  return 'bi_he'; // 不应发生
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/wuxing.test.ts`
Expected: PASS 12/12

- [ ] **Step 5: 给 `directedRelation` 也补单测**

追加 4 行测试：
```ts
it('directed: 金→木 = a_ke_b', () => expect(directedRelation('金', '木')).toBe('a_ke_b'));
it('directed: 木→金 = b_ke_a', () => expect(directedRelation('木', '金')).toBe('b_ke_a'));
it('directed: 金→水 = a_sheng_b', () => expect(directedRelation('金', '水')).toBe('a_sheng_b'));
it('directed: 水→金 = b_sheng_a', () => expect(directedRelation('水', '金')).toBe('b_sheng_a'));
```
Run: `pnpm vitest run lib/meihua/wuxing.test.ts`
Expected: PASS 16/16

- [ ] **Step 6: Commit**

```bash
git add lib/meihua/wuxing.ts lib/meihua/wuxing.test.ts
git commit -m "feat(meihua): wuxing sheng/ke/he relations"
```

---

### Task C5: `lib/meihua/casting/time-casting.ts` 时间起卦 + 单测

**Files:**
- Create: `lib/meihua/casting/time-casting.ts`
- Test: `lib/meihua/casting/time-casting.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { castByTime } from './time-casting';

describe('castByTime', () => {
  it('固定 2026-04-24 12:30 北京时区输出一致', () => {
    const fixed = new Date('2026-04-24T12:30:00+08:00');
    const a = castByTime(fixed);
    const b = castByTime(fixed);
    expect(a).toEqual(b);
  });

  it('返回 upper/lower 在 1-8, dongYao 在 1-6', () => {
    const r = castByTime(new Date('2026-04-24T12:30:00+08:00'));
    expect(r.upper).toBeGreaterThanOrEqual(1);
    expect(r.upper).toBeLessThanOrEqual(8);
    expect(r.lower).toBeGreaterThanOrEqual(1);
    expect(r.lower).toBeLessThanOrEqual(8);
    expect(r.dongYao).toBeGreaterThanOrEqual(1);
    expect(r.dongYao).toBeLessThanOrEqual(6);
  });

  it('公式: 年支序+月+日 mod 8 = upper (0 视 8)', () => {
    // 2026-04-24: 农历丙午年（年支=午=7）、三月（月=3）、初七（日=7） → 7+3+7=17, 17 mod 8 = 1 → 乾
    const r = castByTime(new Date('2026-04-24T12:30:00+08:00'));
    // 注意：此期望值假设 lunar-javascript 的输出。运行时先跑一次记下实际值然后锁死
    expect([1,2,3,4,5,6,7,8]).toContain(r.upper);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/casting/time-casting.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/casting/time-casting.ts`：

```ts
import { Lunar, Solar } from 'lunar-javascript';

export interface TimeCastResult {
  upper: number;   // 1-8
  lower: number;   // 1-8
  dongYao: number; // 1-6
  method: 'time';
  castAt: string;  // ISO
}

// 年支序: 子=1, 丑=2, …, 亥=12
const BRANCH_ORDER: Record<string, number> = {
  子: 1, 丑: 2, 寅: 3, 卯: 4, 辰: 5, 巳: 6,
  午: 7, 未: 8, 申: 9, 酉: 10, 戌: 11, 亥: 12,
};

export function castByTime(d: Date = new Date()): TimeCastResult {
  const solar = Solar.fromDate(d);
  const lunar = solar.getLunar();
  const yearBranch = BRANCH_ORDER[lunar.getYearZhi()];
  const lunarMonth = lunar.getMonth(); // 1-12
  const lunarDay = lunar.getDay();     // 1-30
  const hourBranch = BRANCH_ORDER[lunar.getTimeZhi()];

  const upperRaw = (yearBranch + lunarMonth + lunarDay) % 8;
  const lowerRaw = (yearBranch + lunarMonth + lunarDay + hourBranch) % 8;
  const yaoRaw = (yearBranch + lunarMonth + lunarDay + hourBranch) % 6;

  return {
    upper: upperRaw === 0 ? 8 : upperRaw,
    lower: lowerRaw === 0 ? 8 : lowerRaw,
    dongYao: yaoRaw === 0 ? 6 : yaoRaw,
    method: 'time',
    castAt: d.toISOString(),
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/casting/time-casting.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: 手动验证 1 个已知对照**

随便挑 2026-04-24 12:30 北京时间跑一次，手算农历验证。把结果作为 snapshot 写回测试里（替换 Step 1 里的"期望 upper 任意"为固定值）。

- [ ] **Step 6: Commit**

```bash
git add lib/meihua/casting/time-casting.ts lib/meihua/casting/time-casting.test.ts
git commit -m "feat(meihua): time-based casting (年支+月+日+时支)"
```

---

### Task C6: `lib/meihua/casting/number-casting.ts` 数字起卦 + 单测

**Files:**
- Create: `lib/meihua/casting/number-casting.ts`
- Test: `lib/meihua/casting/number-casting.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { castByNumbers } from './number-casting';

describe('castByNumbers', () => {
  it('1 个数字: 上下同', () => {
    const r = castByNumbers([17]);
    // 17 mod 8 = 1 → 乾, 17 mod 6 = 5
    expect(r.upper).toBe(1);
    expect(r.lower).toBe(1);
    expect(r.dongYao).toBe(5);
  });

  it('2 个数字: upper=N1%8, lower=N2%8, yao=(N1+N2)%6', () => {
    const r = castByNumbers([3, 5]);
    expect(r.upper).toBe(3);
    expect(r.lower).toBe(5);
    expect(r.dongYao).toBe(2); // (3+5)%6=2
  });

  it('3 个数字: upper=N1%8, lower=N2%8, yao=N3%6', () => {
    const r = castByNumbers([3, 5, 7]);
    expect(r.upper).toBe(3);
    expect(r.lower).toBe(5);
    expect(r.dongYao).toBe(1); // 7%6=1
  });

  it('8 mod 8 = 0 视 8', () => {
    const r = castByNumbers([8, 16]);
    expect(r.upper).toBe(8);
    expect(r.lower).toBe(8);
  });

  it('6 mod 6 = 0 视 6', () => {
    const r = castByNumbers([3, 5, 6]);
    expect(r.dongYao).toBe(6);
  });

  it('拒绝空数组', () => {
    expect(() => castByNumbers([])).toThrow();
  });

  it('拒绝非正整数', () => {
    expect(() => castByNumbers([0])).toThrow();
    expect(() => castByNumbers([-1])).toThrow();
    expect(() => castByNumbers([1.5])).toThrow();
  });

  it('拒绝 >3 个', () => {
    expect(() => castByNumbers([1, 2, 3, 4])).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/casting/number-casting.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/casting/number-casting.ts`：

```ts
export interface NumberCastResult {
  upper: number;
  lower: number;
  dongYao: number;
  method: 'number';
  numbers: number[];
}

function mod8(n: number): number {
  const r = n % 8;
  return r === 0 ? 8 : r;
}

function mod6(n: number): number {
  const r = n % 6;
  return r === 0 ? 6 : r;
}

function validate(nums: number[]) {
  if (!nums || nums.length === 0 || nums.length > 3) {
    throw new Error('numbers_invalid_length');
  }
  for (const n of nums) {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('numbers_must_be_positive_integer');
    }
  }
}

export function castByNumbers(numbers: number[]): NumberCastResult {
  validate(numbers);

  let upper: number, lower: number, yao: number;
  if (numbers.length === 1) {
    const n = numbers[0];
    upper = mod8(n);
    lower = mod8(n);
    yao = mod6(n);
  } else if (numbers.length === 2) {
    const [n1, n2] = numbers;
    upper = mod8(n1);
    lower = mod8(n2);
    yao = mod6(n1 + n2);
  } else {
    const [n1, n2, n3] = numbers;
    upper = mod8(n1);
    lower = mod8(n2);
    yao = mod6(n3);
  }

  return { upper, lower, dongYao: yao, method: 'number', numbers };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/casting/number-casting.test.ts`
Expected: PASS 8/8

- [ ] **Step 5: Commit**

```bash
git add lib/meihua/casting/number-casting.ts lib/meihua/casting/number-casting.test.ts
git commit -m "feat(meihua): number-based casting (1/2/3 digits)"
```

---

### Task C7: `lib/meihua/casting/*` 三个 V1.0.5 桩文件

**Files:**
- Create: `lib/meihua/casting/random-casting.ts`
- Create: `lib/meihua/casting/stroke-casting.ts`
- Create: `lib/meihua/casting/coin-casting.ts`

- [ ] **Step 1: 写 3 个 V1.0.5 未实现桩**

每个文件内容：

```ts
// V1.0.5 实现
// 完成时机：MVP 上线后 2-3 周
// 依赖：none（算法层的 derivation/ti-yong/ying-qi 已在 V1.0 完成，桩到位即可复用）

export function castByRandom(): never {
  throw new Error('not_implemented: random-casting will ship in V1.0.5');
}
```

`stroke-casting.ts`、`coin-casting.ts` 同模板，替换函数名：`castByStroke(chars: string)` 和 `castByCoin(throws: Array<'head' | 'tail'>[])`。

- [ ] **Step 2: 确认导出不污染生产**

这 3 个函数在 V1.0 里不被调用。`MeihuaInputCard` 里这 3 种选项是灰色占位，不接路由。

- [ ] **Step 3: Commit**

```bash
git add lib/meihua/casting/random-casting.ts lib/meihua/casting/stroke-casting.ts lib/meihua/casting/coin-casting.ts
git commit -m "feat(meihua): V1.0.5 casting stubs (random/stroke/coin)"
```

---

### Task C8: `lib/meihua/derivation.ts` 互卦 + 变卦 + 卦中卦 + 单测

**Files:**
- Create: `lib/meihua/derivation.ts`
- Test: `lib/meihua/derivation.test.ts`

- [ ] **Step 1: 写失败测试（经典卦例）**

```ts
import { describe, it, expect } from 'vitest';
import { deriveHexagrams } from './derivation';

describe('deriveHexagrams · 乾卦初爻动', () => {
  // 本卦 = 乾为天(1,1), 动爻 = 1
  // 变卦 = 乾的初爻阳变阴 = 天风姤(1,5)
  // 互卦 = 本卦 234 爻作下 + 345 爻作上 = 乾乾 = 乾为天(1,1)
  // 卦中卦 = 变卦的互卦 = 乾为天(1,1) （姤的 234=乾, 345=乾）
  it('returns 4 卦', () => {
    const r = deriveHexagrams({ upper: 1, lower: 1, dongYao: 1 });
    expect(r.ben).toEqual({ upper: 1, lower: 1 });
    expect(r.bian).toEqual({ upper: 1, lower: 5 }); // 乾变巽下 = 天风姤
    expect(r.hu).toEqual({ upper: 1, lower: 1 });
    expect(r.guaZhongGua).toEqual({ upper: 1, lower: 1 });
  });
});

describe('deriveHexagrams · 坎卦三爻动', () => {
  // 本卦 = 坎为水(6,6), 动爻 = 3（下卦最上爻）
  // 坎的爻序: 下卦 初阴二阳三阴, 上卦 四阴五阳六阴
  // 本卦各爻 (从下到上): 阴阳阴 阴阳阴
  // 动 3 爻（下卦阴→阳）→ 下卦变为 阴阳阳 = 兑(2)
  // 变卦 = 坎上兑下 = 水泽节(6,2)
  it('returns 正确 bian', () => {
    const r = deriveHexagrams({ upper: 6, lower: 6, dongYao: 3 });
    expect(r.ben).toEqual({ upper: 6, lower: 6 });
    expect(r.bian).toEqual({ upper: 6, lower: 2 });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/derivation.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/derivation.ts`：

```ts
// 八卦 -> 3 爻的阴阳表示: 1 = 阳, 0 = 阴
// 爻序 index: 0 = 初爻（最下）, 1 = 中爻, 2 = 上爻（最上）
const TRIGRAM_LINES: Record<number, [number, number, number]> = {
  1: [1, 1, 1], // 乾 三阳
  2: [1, 1, 0], // 兑 (初阳二阳三阴)
  3: [1, 0, 1], // 离 (初阳二阴三阳)
  4: [1, 0, 0], // 震 (初阳二阴三阴)
  5: [0, 1, 1], // 巽
  6: [0, 1, 0], // 坎
  7: [0, 0, 1], // 艮
  8: [0, 0, 0], // 坤 三阴
};

const LINES_TO_TRIGRAM: Record<string, number> = Object.fromEntries(
  Object.entries(TRIGRAM_LINES).map(([k, v]) => [v.join(''), Number(k)])
);

export interface CastInput {
  upper: number;   // 1-8
  lower: number;   // 1-8
  dongYao: number; // 1-6
}

export interface HexagramRef {
  upper: number;
  lower: number;
}

export interface DeriveResult {
  ben: HexagramRef;
  hu: HexagramRef;
  bian: HexagramRef;
  guaZhongGua: HexagramRef;
}

/** 展开 6 爻数组: [lower[0], lower[1], lower[2], upper[0], upper[1], upper[2]] */
function flatten(input: HexagramRef): [number, number, number, number, number, number] {
  const lo = TRIGRAM_LINES[input.lower];
  const up = TRIGRAM_LINES[input.upper];
  return [...lo, ...up] as any;
}

function pack(lines: [number, number, number, number, number, number]): HexagramRef {
  const lowerKey = `${lines[0]}${lines[1]}${lines[2]}`;
  const upperKey = `${lines[3]}${lines[4]}${lines[5]}`;
  return { lower: LINES_TO_TRIGRAM[lowerKey], upper: LINES_TO_TRIGRAM[upperKey] };
}

/** 互卦: 本卦 2-3-4 爻作下, 3-4-5 爻作上（爻位 1-based） */
function huGua(ben: HexagramRef): HexagramRef {
  const l = flatten(ben); // 0-indexed: 爻位1=l[0]
  return pack([l[1], l[2], l[3], l[2], l[3], l[4]]);
}

/** 变卦: 动爻位阴阳翻转 */
function bianGua(ben: HexagramRef, dongYao: number): HexagramRef {
  const l = flatten(ben);
  l[dongYao - 1] = l[dongYao - 1] === 1 ? 0 : 1;
  return pack(l as any);
}

export function deriveHexagrams(input: CastInput): DeriveResult {
  const ben: HexagramRef = { upper: input.upper, lower: input.lower };
  const bian = bianGua(ben, input.dongYao);
  const hu = huGua(ben);
  const guaZhongGua = huGua(bian); // 卦中卦 = 变卦的互卦
  return { ben, hu, bian, guaZhongGua };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/derivation.test.ts`
Expected: PASS 2/2

- [ ] **Step 5: 追加 3 个更复杂的卦例**

```ts
it('水天需 2爻动 → 水火既济', () => {
  // 需 = 坎(6) 乾(1), 乾的二爻阳动变阴 = 离(3) → 水火既济(6,3)
  const r = deriveHexagrams({ upper: 6, lower: 1, dongYao: 2 });
  expect(r.bian).toEqual({ upper: 6, lower: 3 });
});

it('坤为地 6爻动 → 山地剥', () => {
  // 坤(8) 坤(8), 上爻阴变阳，上卦坤(000)变艮(001) → (7,8) 山地剥
  const r = deriveHexagrams({ upper: 8, lower: 8, dongYao: 6 });
  expect(r.bian).toEqual({ upper: 7, lower: 8 });
});

it('离为火 5爻动 → 天火同人', () => {
  // 离(3) 离(3), 五爻阴变阳, 离(101)上卦五爻（middle）变 → 乾(111)
  const r = deriveHexagrams({ upper: 3, lower: 3, dongYao: 5 });
  expect(r.bian).toEqual({ upper: 1, lower: 3 });
});
```

Run: `pnpm vitest run lib/meihua/derivation.test.ts`
Expected: PASS 5/5

- [ ] **Step 6: Commit**

```bash
git add lib/meihua/derivation.ts lib/meihua/derivation.test.ts
git commit -m "feat(meihua): hu/bian/guaZhongGua derivation"
```

---

### Task C9: `lib/meihua/ti-yong.ts` 体用判断 + 单测

**Files:**
- Create: `lib/meihua/ti-yong.ts`
- Test: `lib/meihua/ti-yong.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { judgeTiYong } from './ti-yong';

describe('judgeTiYong', () => {
  // 水天需 (上坎水/下乾金), 动爻 2 → 下卦=用 = 金, 上卦=体 = 水
  // 关系: 用(金) 生 体(水) → yong_sheng_ti → 大吉
  it('水天需 2爻动: 用生体 = 大吉', () => {
    const r = judgeTiYong({
      upperWuxing: '水',
      lowerWuxing: '金',
      dongYao: 2,
    });
    expect(r.ti).toBe('upper');
    expect(r.yong).toBe('lower');
    expect(r.relation).toBe('yong_sheng_ti');
    expect(r.verdict).toBe('吉');
  });

  // 水火既济 (上坎水/下离火), 动爻 5 → 上卦=用 = 水, 下卦=体 = 火
  // 关系: 用(水) 克 体(火) → yong_ke_ti → 凶
  it('水火既济 5爻动: 用克体 = 凶', () => {
    const r = judgeTiYong({
      upperWuxing: '水',
      lowerWuxing: '火',
      dongYao: 5,
    });
    expect(r.ti).toBe('lower');
    expect(r.yong).toBe('upper');
    expect(r.relation).toBe('yong_ke_ti');
    expect(r.verdict).toBe('凶');
  });

  // 乾为天 (金/金), 任何动爻 → 比和
  it('乾为天 3爻动: 比和 = 平', () => {
    const r = judgeTiYong({
      upperWuxing: '金',
      lowerWuxing: '金',
      dongYao: 3,
    });
    expect(r.relation).toBe('bi_he');
    expect(r.verdict).toBe('平');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/ti-yong.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/ti-yong.ts`：

```ts
import type { Wuxing } from './hexagram-data';
import { directedRelation } from './wuxing';

export type Position = 'upper' | 'lower';
export type TiYongRelation = 'ti_sheng_yong' | 'yong_sheng_ti' | 'ti_ke_yong' | 'yong_ke_ti' | 'bi_he';
export type Verdict = '吉' | '凶' | '平';

export interface TiYongResult {
  ti: Position;
  yong: Position;
  tiWuxing: Wuxing;
  yongWuxing: Wuxing;
  relation: TiYongRelation;
  verdict: Verdict;
}

interface Input {
  upperWuxing: Wuxing;
  lowerWuxing: Wuxing;
  dongYao: number; // 1-6
}

export function judgeTiYong(input: Input): TiYongResult {
  const dongInLower = input.dongYao <= 3;
  const yong: Position = dongInLower ? 'lower' : 'upper';
  const ti: Position = dongInLower ? 'upper' : 'lower';
  const yongWuxing = dongInLower ? input.lowerWuxing : input.upperWuxing;
  const tiWuxing = dongInLower ? input.upperWuxing : input.lowerWuxing;

  // 以 ti 为 a, yong 为 b
  const dr = directedRelation(tiWuxing, yongWuxing);

  let relation: TiYongRelation;
  switch (dr) {
    case 'a_sheng_b': relation = 'ti_sheng_yong'; break; // 体生用 → 泄气, 凶
    case 'b_sheng_a': relation = 'yong_sheng_ti'; break; // 用生体 → 大吉
    case 'a_ke_b':   relation = 'ti_ke_yong';   break; // 体克用 → 吉
    case 'b_ke_a':   relation = 'yong_ke_ti';   break; // 用克体 → 凶
    default:         relation = 'bi_he';         break;
  }

  const verdictMap: Record<TiYongRelation, Verdict> = {
    yong_sheng_ti: '吉',
    ti_ke_yong:    '吉',
    bi_he:         '平',
    ti_sheng_yong: '凶', // 泄气，略不利
    yong_ke_ti:    '凶',
  };

  return {
    ti,
    yong,
    tiWuxing,
    yongWuxing,
    relation,
    verdict: verdictMap[relation],
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/ti-yong.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: Commit**

```bash
git add lib/meihua/ti-yong.ts lib/meihua/ti-yong.test.ts
git commit -m "feat(meihua): ti-yong judgment (5 relations)"
```

---

### Task C10: `lib/meihua/ying-qi.ts` 应期推算 + 单测

**Files:**
- Create: `lib/meihua/ying-qi.ts`
- Test: `lib/meihua/ying-qi.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { computeYingQi } from './ying-qi';

describe('computeYingQi', () => {
  it('相生类 → fast', () => {
    const r = computeYingQi({ relation: 'yong_sheng_ti', dongYao: 2 });
    expect(r.speed).toBe('fast');
    expect(r.timeHint).toMatch(/日内|周内/);
    expect(r.branchHour).toBeTruthy();
  });

  it('比和 → medium', () => {
    const r = computeYingQi({ relation: 'bi_he', dongYao: 3 });
    expect(r.speed).toBe('medium');
    expect(r.timeHint).toMatch(/本月|月内/);
  });

  it('相克类 → slow', () => {
    const r = computeYingQi({ relation: 'yong_ke_ti', dongYao: 5 });
    expect(r.speed).toBe('slow');
    expect(r.timeHint).toMatch(/月内|季度/);
  });

  it('体生用 → 虽是泄气但也是相生类 → fast', () => {
    const r = computeYingQi({ relation: 'ti_sheng_yong', dongYao: 2 });
    expect(r.speed).toBe('fast');
  });

  it('branchHour 包含时辰和时间段描述', () => {
    const r = computeYingQi({ relation: 'bi_he', dongYao: 1 });
    expect(r.branchHour).toMatch(/[子丑寅卯辰巳午未申酉戌亥]时/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/ying-qi.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/ying-qi.ts`：

```ts
import type { TiYongRelation } from './ti-yong';

export type Speed = 'fast' | 'medium' | 'slow';

export interface YingQiResult {
  speed: Speed;
  timeHint: string;
  branchHour: string;
}

const SPEED_MAP: Record<TiYongRelation, Speed> = {
  yong_sheng_ti: 'fast',
  ti_sheng_yong: 'fast',
  bi_he:         'medium',
  ti_ke_yong:    'slow',
  yong_ke_ti:    'slow',
};

const HINT_MAP: Record<Speed, string> = {
  fast:   '1–3 日内或本周内',
  medium: '本月内',
  slow:   '1–3 个月内',
};

// 爻位 → 地支（梅花常见对应：初爻子, 二爻丑/寅… 简化版：动爻数直接映射时辰序数）
// 用常见映射: 爻位 -> 地支序数（子=1 … 亥=12），每爻跳 2 个地支
const YAO_TO_BRANCH: Record<number, { branch: string; range: string }> = {
  1: { branch: '子', range: '23:00–01:00' },
  2: { branch: '寅', range: '03:00–05:00' },
  3: { branch: '辰', range: '07:00–09:00' },
  4: { branch: '午', range: '11:00–13:00' },
  5: { branch: '申', range: '15:00–17:00' },
  6: { branch: '戌', range: '19:00–21:00' },
};

interface Input {
  relation: TiYongRelation;
  dongYao: number; // 1-6
}

export function computeYingQi(input: Input): YingQiResult {
  const speed = SPEED_MAP[input.relation];
  const timeHint = HINT_MAP[speed];
  const b = YAO_TO_BRANCH[input.dongYao];
  const branchHour = `${b.branch}时 ${b.range}`;
  return { speed, timeHint, branchHour };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/ying-qi.test.ts`
Expected: PASS 5/5

- [ ] **Step 5: 添加文件头注释说明可替换性**

文件头加注释：

```ts
/**
 * 梅花易数 · 应期推算（MVP 简化版）
 *
 * 规则来源：spec 5.4 节；正式规则引擎到位后整块替换本文件。
 * 替换约束：保持 `computeYingQi(input) → YingQiResult` 的签名不变即可。
 */
```

- [ ] **Step 6: Commit**

```bash
git add lib/meihua/ying-qi.ts lib/meihua/ying-qi.test.ts
git commit -m "feat(meihua): ying-qi estimation (MVP simplified rules)"
```

---

### Task C11: `lib/meihua/index.ts` 集成 `castAndAnalyze()` + 集成测试

**Files:**
- Create: `lib/meihua/index.ts`
- Test: `lib/meihua/index.test.ts`

- [ ] **Step 1: 写集成测试**

```ts
import { describe, it, expect } from 'vitest';
import { castAndAnalyze } from './index';

describe('castAndAnalyze integration', () => {
  it('time method 返回完整 result', async () => {
    const fixed = new Date('2026-04-24T12:30:00+08:00');
    const r = await castAndAnalyze({ method: 'time', castAt: fixed });
    expect(r.benGua.number).toBeGreaterThan(0);
    expect(r.huGua.number).toBeGreaterThan(0);
    expect(r.bianGua.number).toBeGreaterThan(0);
    expect(r.guaZhongGua.number).toBeGreaterThan(0);
    expect(r.dongYao).toBeGreaterThanOrEqual(1);
    expect(r.dongYao).toBeLessThanOrEqual(6);
    expect(['吉', '凶', '平']).toContain(r.tiYong.verdict);
    expect(['fast', 'medium', 'slow']).toContain(r.yingQi.speed);
  });

  it('number method [3, 5] 返回完整 result', async () => {
    const r = await castAndAnalyze({ method: 'number', numbers: [3, 5] });
    expect(r.benGua.upper_trigram).toBe('离'); // 3 = 离
    expect(r.benGua.lower_trigram).toBe('巽'); // 5 = 巽
    expect(r.dongYao).toBe(2); // (3+5)%6=2
  });

  it('拒绝非法 method', async () => {
    await expect(castAndAnalyze({ method: 'invalid' } as any)).rejects.toThrow();
  });
});
```

注意：此测试需要 DB 连接（因为要查 `hexagrams` 表）。确保测试环境有 SUPABASE_URL + anon key。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/meihua/index.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/meihua/index.ts`：

```ts
import { castByTime } from './casting/time-casting';
import { castByNumbers } from './casting/number-casting';
import { deriveHexagrams } from './derivation';
import { judgeTiYong } from './ti-yong';
import { computeYingQi } from './ying-qi';
import { findHexagramByTrigrams, NUM_TO_TRIGRAM, TRIGRAM_WUXING, type Hexagram } from './hexagram-data';

export type CastInput =
  | { method: 'time'; castAt: Date }
  | { method: 'number'; numbers: number[] };

export interface CastResult {
  benGua: Hexagram;
  huGua: Hexagram;
  bianGua: Hexagram;
  guaZhongGua: Hexagram;
  dongYao: number;
  tiYong: ReturnType<typeof judgeTiYong>;
  yingQi: ReturnType<typeof computeYingQi>;
  meta: {
    method: 'time' | 'number';
    input: unknown;
  };
}

async function resolveHex(upper: number, lower: number): Promise<Hexagram> {
  return findHexagramByTrigrams(NUM_TO_TRIGRAM[upper], NUM_TO_TRIGRAM[lower]);
}

export async function castAndAnalyze(input: CastInput): Promise<CastResult> {
  // 1. 起卦
  let casting: { upper: number; lower: number; dongYao: number; meta: unknown };
  if (input.method === 'time') {
    const r = castByTime(input.castAt);
    casting = { upper: r.upper, lower: r.lower, dongYao: r.dongYao, meta: { castAt: r.castAt } };
  } else if (input.method === 'number') {
    const r = castByNumbers(input.numbers);
    casting = { upper: r.upper, lower: r.lower, dongYao: r.dongYao, meta: { numbers: r.numbers } };
  } else {
    throw new Error('unsupported_method');
  }

  // 2. 推演
  const refs = deriveHexagrams(casting);

  // 3. 读 4 卦完整数据
  const [benGua, huGua, bianGua, guaZhongGua] = await Promise.all([
    resolveHex(refs.ben.upper,   refs.ben.lower),
    resolveHex(refs.hu.upper,    refs.hu.lower),
    resolveHex(refs.bian.upper,  refs.bian.lower),
    resolveHex(refs.guaZhongGua.upper, refs.guaZhongGua.lower),
  ]);

  // 4. 体用
  const tiYong = judgeTiYong({
    upperWuxing: TRIGRAM_WUXING[NUM_TO_TRIGRAM[casting.upper]],
    lowerWuxing: TRIGRAM_WUXING[NUM_TO_TRIGRAM[casting.lower]],
    dongYao: casting.dongYao,
  });

  // 5. 应期
  const yingQi = computeYingQi({
    relation: tiYong.relation,
    dongYao: casting.dongYao,
  });

  return {
    benGua,
    huGua,
    bianGua,
    guaZhongGua,
    dongYao: casting.dongYao,
    tiYong,
    yingQi,
    meta: { method: input.method, input: casting.meta },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/meihua/index.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: 运行全部梅花测试**

Run: `pnpm vitest run lib/meihua/`
Expected: PASS（全部 50+ 测试用例通过）

- [ ] **Step 6: Commit**

```bash
git add lib/meihua/index.ts lib/meihua/index.test.ts
git commit -m "feat(meihua): integrate castAndAnalyze() end-to-end"
```

---

### Task C12 (W3 末硬 gate): 朋友 5 案例验收 + 降级决策

**Files:**
- Create: `docs/superpowers/gates/2026-W3-meihua-review.md`（验收记录）

- [ ] **Step 1: 准备 5 个真实案例**

挑 5 个生活情境，涵盖不同用途：

| # | 问题 | 起卦方式 | 预先算出的 result |
|---|---|---|---|
| 1 | 近期工作会不会有变动？ | 数字起卦 [7, 3] | （跑一次 `castAndAnalyze` 得到 result，拷贝到此处） |
| 2 | 这段感情值得继续吗？ | 时间起卦（某固定时刻） | … |
| 3 | 下个月的投资决策？ | 数字起卦 [5, 8, 2] | … |
| 4 | 身体健康状况？ | 时间起卦 | … |
| 5 | 要不要搬家？ | 数字起卦 [1, 4] | … |

对每个案例，把本/互/变/卦中卦名、动爻、体用、应期格式化成一页 markdown。

- [ ] **Step 2: 找 1 位懂梅花易数的朋友评审**

让朋友对每个案例标 3 档：
- ✅ 合理（卦象推演和判断对得上传统规则）
- ⚠️ 有偏差但不离谱
- ❌ 明显错误（应期方向反了、体用判错等）

- [ ] **Step 3: 判断 gate 结果**

- **通过（≥4 个 ✅）**：记录评审意见到 `gates/2026-W3-meihua-review.md`，继续 W4 的梅花 prompt/API/UI（Section F）
- **不通过（<4 个 ✅）**：
  1. 记录哪些案例错、为什么错
  2. 若是爻数据问题 → 回 Task C1 换 npm 包或走 fallback D
  3. 若是推演逻辑问题 → 回 Task C8/C9/C10 修算法
  4. **触发降级预案**：梅花易数整体推到 V1.0.1（MVP 上线后 1 周内补），跳过本计划的 Section F，直接进 W4 的 D/E。**主 MVP 5 周不延期。**

- [ ] **Step 4: 写验收报告**

`docs/superpowers/gates/2026-W3-meihua-review.md`：

```markdown
# 梅花易数 W3 末硬 gate · 验收报告

**日期**: YYYY-MM-DD
**评审人**: [朋友名]（懂梅花易数 X 年）
**评审环境**: 本地 pnpm dev + 5 个手工案例

## 案例评审

| # | 问题 | 起卦 | 本卦 | 动爻 | 体用 verdict | 应期 | 评审 |
|---|---|---|---|---|---|---|---|
| 1 | … | 数字[7,3] | 地天泰 | 5 | 吉 | fast-戌时 | ✅ |
| … | … | … | … | … | … | … | … |

**合理**: X/5
**有偏差**: X/5
**错误**: X/5

## 结论

**Gate 状态**: 通过 / 不通过

**后续动作**:
- 若通过：继续 Section F（W4 梅花 prompt/API/UI）
- 若不通过：[具体问题清单 + 修复任务 or 降级到 V1.0.1]
```

- [ ] **Step 5: Commit 验收记录**

```bash
git add docs/superpowers/gates/2026-W3-meihua-review.md
git commit -m "gate(meihua): W3 末 5 案例验收报告"
```

**⚠️ 如果此 gate 不通过 → 跳过下面的 Section F（梅花 W4 部分），直接进 Section D + E。**

---

## Section D — 首页运势（M2）

### Task D1: `lib/fortune/scorer.ts` 7 维度评分 + 单测

**Files:**
- Create: `lib/fortune/scorer.ts`
- Test: `lib/fortune/scorer.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { computeDailyScore } from './scorer';

describe('computeDailyScore', () => {
  const chart = {
    dayMaster: '甲',          // 甲木
    favorableGods: ['水', '木'], // 喜用神
  };

  it('返回 7 维度 + overall', () => {
    const date = new Date('2026-04-24T00:00:00+08:00');
    const r = computeDailyScore(chart as any, date);
    expect(Object.keys(r.scores)).toHaveLength(7);
    expect(r.overall).toBeGreaterThanOrEqual(55);
    expect(r.overall).toBeLessThanOrEqual(95);
  });

  it('同一输入输出一致', () => {
    const date = new Date('2026-04-24T00:00:00+08:00');
    const a = computeDailyScore(chart as any, date);
    const b = computeDailyScore(chart as any, date);
    expect(a).toEqual(b);
  });

  it('分数都在 [55, 95] 内', () => {
    const date = new Date('2026-04-24T00:00:00+08:00');
    const r = computeDailyScore(chart as any, date);
    for (const v of Object.values(r.scores)) {
      expect(v).toBeGreaterThanOrEqual(55);
      expect(v).toBeLessThanOrEqual(95);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/fortune/scorer.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
import { Lunar, Solar } from 'lunar-javascript';

const DIMENSIONS = ['综合', '事业', '财运', '感情', '人际', '健康', '学业'] as const;
type Dimension = typeof DIMENSIONS[number];

interface BaziChart {
  dayMaster: string;
  favorableGods: string[]; // ['水', '木'] 等
}

interface DailyScore {
  overall: number;
  scores: Record<Dimension, number>;
}

// 天干 → 五行
const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

export function computeDailyScore(chart: BaziChart, date: Date): DailyScore {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  const todayGan = lunar.getDayGan();
  const todayWuxing = GAN_WUXING[todayGan];

  const base = 60;
  const favorableBonus = chart.favorableGods.includes(todayWuxing) ? 15 : -10;

  const scores = {} as Record<Dimension, number>;
  for (const dim of DIMENSIONS) {
    let s = base + favorableBonus;

    // 日柱关系调整（简化版）
    const relation = tenGodRelation(chart.dayMaster, todayGan);
    switch (relation) {
      case 'sheng_me':   s += 10; break; // 生我（正/偏印）
      case 'same':       s += 5;  break; // 比肩劫财
      case 'me_sheng':   s += 5;  break; // 食神伤官
      case 'me_ke':      s += dim === '财运' ? 15 : 3; break;
      case 'ke_me':      s += dim === '事业' ? 10 : (dim === '感情' || dim === '健康') ? -5 : 0; break;
    }

    s = Math.max(55, Math.min(95, s));
    scores[dim] = s;
  }

  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 7);
  return { overall, scores };
}

function tenGodRelation(me: string, other: string): 'sheng_me' | 'same' | 'me_sheng' | 'me_ke' | 'ke_me' {
  const m = GAN_WUXING[me];
  const o = GAN_WUXING[other];
  if (m === o) return 'same';
  const shengChain = ['金', '水', '木', '火', '土', '金'];
  const keChain = ['金', '木', '土', '水', '火', '金'];
  const shengIdx = shengChain.indexOf(m);
  if (shengChain[shengIdx + 1] === o) return 'me_sheng';
  if (shengChain[(shengIdx + 4) % 5] === o) return 'sheng_me';
  const keIdx = keChain.indexOf(m);
  if (keChain[keIdx + 1] === o) return 'me_ke';
  return 'ke_me';
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/fortune/scorer.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: 加可替换文件头注释**

```ts
/**
 * 首页运势 · 7 维度评分（MVP 简化版）
 *
 * 规则来源：spec 5.3 节；正式规则引擎到位后整块替换本文件。
 * 替换约束：保持 `computeDailyScore(chart, date) → DailyScore` 签名不变。
 */
```

- [ ] **Step 6: Commit**

```bash
git add lib/fortune/scorer.ts lib/fortune/scorer.test.ts
git commit -m "feat(fortune): 7-dimension daily score (MVP rules)"
```

---

### Task D2: `lib/fortune/attributes.ts` 幸运色/方位/时辰 + 单测

**Files:**
- Create: `lib/fortune/attributes.ts`
- Test: `lib/fortune/attributes.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { computeAttributes } from './attributes';

describe('computeAttributes', () => {
  it('返回完整属性', () => {
    const r = computeAttributes('甲', new Date('2026-04-24T00:00:00+08:00'));
    expect(r.color).toBeTruthy();
    expect(r.direction).toBeTruthy();
    expect(r.hour).toBeTruthy();
    expect(r.number).toBeGreaterThanOrEqual(1);
    expect(r.flower).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run lib/fortune/attributes.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
import { Lunar, Solar } from 'lunar-javascript';

const WUXING_COLOR: Record<string, string> = {
  金: '白色', 木: '青绿色', 水: '黑/蓝色', 火: '红色', 土: '黄色',
};
const WUXING_DIRECTION: Record<string, string> = {
  金: '西方', 木: '东方', 水: '北方', 火: '南方', 土: '中宫',
};
const WUXING_FLOWER: Record<string, string> = {
  金: '白玉兰', 木: '茉莉', 水: '蓝绣球', 火: '红玫瑰', 土: '向日葵',
};
const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const BRANCH_HOUR: Record<string, string> = {
  子: '子时 23-01', 丑: '丑时 01-03', 寅: '寅时 03-05', 卯: '卯时 05-07',
  辰: '辰时 07-09', 巳: '巳时 09-11', 午: '午时 11-13', 未: '未时 13-15',
  申: '申时 15-17', 酉: '酉时 17-19', 戌: '戌时 19-21', 亥: '亥时 21-23',
};

export interface Attributes {
  color: string;
  direction: string;
  hour: string;
  number: number;
  flower: string;
}

export function computeAttributes(dayMaster: string, date: Date): Attributes {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  const todayGan = lunar.getDayGan();
  const todayZhi = lunar.getDayZhi();
  const todayWuxing = GAN_WUXING[todayGan];

  const branchOrder = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const branchIdx = branchOrder.indexOf(todayZhi);

  return {
    color:     WUXING_COLOR[todayWuxing],
    direction: WUXING_DIRECTION[todayWuxing],
    hour:      BRANCH_HOUR[todayZhi],
    number:    branchIdx + 1,
    flower:    WUXING_FLOWER[todayWuxing],
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run lib/fortune/attributes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/fortune/attributes.ts lib/fortune/attributes.test.ts
git commit -m "feat(fortune): lucky color/direction/hour attributes"
```

---

### Task D3: 落 `fortune.daily` prompt

**Files:**
- Modify: `db/seed/prompts.sql`

- [ ] **Step 1: append INSERT**

```sql
INSERT INTO prompts (key, version, system_prompt, user_prompt_tpl, active) VALUES
('fortune.daily', 1,
'你是一位亲切的日运顾问。给定用户八字日主、喜用神、当日干支、7 维度评分，输出当日运势 JSON。

风格:
- 治愈向、避免负面词；分数差的维度转化为 "善意提醒"
- 每个维度给 1-2 句具体生活化建议
- 严格 JSON，不要 markdown 代码块围栏

输出 JSON schema:
{
  "oneLiner": "一句话总评",
  "readings": {
    "综合": "...", "事业": "...", "财运": "...", "感情": "...",
    "人际": "...", "健康": "...", "学业": "..."
  },
  "attributes": {"color":"...","direction":"...","hour":"...","number":1,"flower":"..."}
}',
'用户八字日主: {dayMaster}
喜用神: {favorableGods}
今日干支: {todayGan}{todayZhi}
7 维度分数: {scores}
幸运属性: {attributes}

请输出当日运势 JSON。',
true)
ON CONFLICT (key, version) DO UPDATE SET system_prompt = EXCLUDED.system_prompt, user_prompt_tpl = EXCLUDED.user_prompt_tpl, active = EXCLUDED.active;
```

- [ ] **Step 2: 导入验证**

Run: `psql $SUPABASE_DB_URL -f db/seed/prompts.sql`

- [ ] **Step 3: 顺手 seed `chat.general` v1（spec §5.2 列出的 6 个核心 prompt 之一）**

> **背景：** P1 G1 已把通用 chat 的 system prompt 硬编码在 `app/api/chat/route.ts`。spec §5.2 要求所有 prompt 落表便于零发版调优。本步把它移到 prompts 表，route 改为 `loadPrompt('chat.general')`。

追加到 `db/seed/prompts.sql`：

```sql
INSERT INTO prompts (key, version, system_prompt, user_prompt_tpl, active) VALUES
('chat.general', 1,
'你是轻运 AI，一位温柔、年轻化的国学陪伴助手。

风格:
- 简短、治愈、像朋友聊天
- 严禁"大凶/倒霉/厄运/不祥"等负面词
- 不确定的事不强答，引导用户用更具体的占卜入口（抽签/解梦/八字/梅花）
- 不超过 6 句话',
'{userMessage}',
true)
ON CONFLICT (key, version) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_tpl = EXCLUDED.user_prompt_tpl,
  active = EXCLUDED.active;
```

```bash
psql $SUPABASE_DB_URL -f db/seed/prompts.sql
psql $SUPABASE_DB_URL -c "SELECT key, version, active FROM prompts ORDER BY key;"
```

Expected: 看到 `chat.general | 1 | t` + `fortune.daily | 1 | t` 两行（其它 5 个 prompt 由本 Section + Section A/B/E/F 后续 seed）。

- [ ] **Step 4: 改 `/api/chat/route.ts` 改用 loadPrompt**

把 P1 G1 硬编码的 system prompt 替换为：

```ts
import { loadPrompt } from "@/lib/ai/prompts";
// ...
const tpl = await loadPrompt("chat.general");
const stream = await chat({
  systemPrompt: tpl.systemPrompt,
  messages: [{ role: "user", content: text }],
  stream: true,
  meta: { conversationId: convId, userId: user.id },
});
```

- [ ] **Step 5: Commit**

```bash
git add db/seed/prompts.sql app/api/chat/route.ts
git commit -m "feat(ai): seed fortune.daily + chat.general prompt v1"
```

---

### Task D4: `/api/fortune/daily` 路由（含缓存）

**Files:**
- Create: `app/api/fortune/daily/route.ts`

- [ ] **Step 1: 写完整路由**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { Solar } from 'lunar-javascript';
import { createServerClient } from '@/lib/supabase/server';
import { computeDailyScore } from '@/lib/fortune/scorer';
import { computeAttributes } from '@/lib/fortune/attributes';
import { aiChat } from '@/lib/ai/client';

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const profileId = req.nextUrl.searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'missing_profileId' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  // 1. 查缓存
  const { data: cached } = await supabase
    .from('fortunes')
    .select('*')
    .eq('profile_id', profileId)
    .eq('fortune_date', today)
    .maybeSingle();
  if (cached) return NextResponse.json(cached);

  // 2. 未命中 → 算
  const { data: chart } = await supabase
    .from('bazi_charts')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  if (!chart) return NextResponse.json({ error: 'chart_not_found' }, { status: 404 });

  const now = new Date();
  const lunar = Solar.fromDate(now).getLunar();
  const todayGan = lunar.getDayGan();
  const todayZhi = lunar.getDayZhi();

  const { overall, scores } = computeDailyScore(chart, now);
  const attributes = computeAttributes(chart.day_master, now);

  // 3. 调 AI 填解读
  const { text: aiText, tokensUsed } = await aiChat({
    intent: 'fortune.daily',
    variables: {
      dayMaster: chart.day_master,
      favorableGods: JSON.stringify(chart.favorable_gods),
      todayGan,
      todayZhi,
      scores: JSON.stringify(scores),
      attributes: JSON.stringify(attributes),
    },
    stream: false,
    userId: user.id,
  });
  const parsed = JSON.parse(aiText);

  // 4. 写缓存
  const { data: saved } = await supabase
    .from('fortunes')
    .insert({
      profile_id: profileId,
      fortune_date: today,
      score_overall: overall,
      scores,
      one_liner: parsed.oneLiner,
      readings: parsed.readings,
      attributes: parsed.attributes,
      model: 'deepseek-chat',
      tokens_used: tokensUsed,
    })
    .select()
    .single();

  return NextResponse.json(saved);
}
```

注：此路由假设 P1 里 `lib/ai/client.ts` 的 `aiChat()` 返回 `{text, tokensUsed}`，stream=false 时是完整字符串。若 P1 返回签名不同，此处调整 destructure。

- [ ] **Step 2: 手动测 API**

```bash
curl "http://localhost:3000/api/fortune/daily?profileId=$PROFILE_ID" \
  -H "Cookie: $(grep sb-access /tmp/cookies.txt)"
```
Expected: 返回完整 fortune JSON；再调一次，second 应该命中缓存（无 DeepSeek 请求）

- [ ] **Step 3: Commit**

```bash
git add app/api/fortune/daily/route.ts
git commit -m "feat(api): GET /api/fortune/daily with daily cache"
```

---

### Task D5: 首页 Server Component 读档案 → 运势

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 改首页**

```tsx
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { DailyFortuneCard } from '@/components/DailyFortuneCard';
import { OnboardingCTA } from '@/components/OnboardingCTA';

export default async function HomePage() {
  const supabase = createServerClient();
  const cookieStore = cookies();
  const profileId = cookieStore.get('active_profile_id')?.value;

  if (!profileId) return <OnboardingCTA />;

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/fortune/daily?profileId=${profileId}`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  });
  const fortune = await res.json();
  if (fortune.error) return <OnboardingCTA message={fortune.error} />;

  return <DailyFortuneCard fortune={fortune} />;
}
```

- [ ] **Step 2: 建 `<DailyFortuneCard>` + `<OnboardingCTA>` 静态版**

`components/DailyFortuneCard.tsx`：展示 oneLiner + 7 维度分数条 + 幸运属性。
`components/OnboardingCTA.tsx`：一句"完善档案解锁每日运势" + 按钮跳 `/onboarding`。

- [ ] **Step 3: 手动验证**

已登录 + 有档案 → 看运势卡片；无档案 → 看 CTA

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/DailyFortuneCard.tsx components/OnboardingCTA.tsx
git commit -m "feat(fortune): home page with daily fortune card"
```

---

### Task D6: DailyFortuneCard 视觉实装（素笺仙气 §1 Home）

**Files:**
- Modify: `components/DailyFortuneCard.tsx`（替换 D5 的静态占位为完整视觉）

> **变更说明：** 不走 v0.dev 通用风格 prompt；直接按 `docs/superpowers/designs/prompts-all-pages.md` §1 Home 页布局规约，套 P1 Section S 建好的 token 和原子组件实装。v0.dev 仅作为辅助灵感工具，不做最终输出来源。

- [ ] **Step 1: 通读 §1 Home Page prompt 关键点**

抽出本卡需要实装的：
- HEADER 52px 含 ✦ logo / 当日干支 serif date / 32px avatar
- HERO 大圆形分数仪表 180px，外环淡紫粉渐变 stroke 4px，居中数字 serif 52px 墨紫 + 标签 "综合运势"
- 圆环上方一个 lavender WatercolorDot
- 7 维度条（标签 letter-spaced 10px / 6px 高 progress 淡紫粉渐变 / 右侧 mono 数字 #8B7AA5）
- 6 张幸运属性 pill 卡（2x3 网格，glass 玻璃面，每张左上角 ✦）

- [ ] **Step 2: 实装组件**

```tsx
"use client";
import { GlassCard, Sparkle, WatercolorDot } from "@/components/su";

interface Fortune {
  overall: number;
  scores: Record<string, number>;
  oneLiner: string;
  attributes: { color: string; direction: string; hour: string; number: string; flower: string; item: string };
  ganZhiToday: string; // 例 "丙午年 · 三月初七 · 谷雨"
  nickname: string;
}

const DIMS = ["综合", "事业", "财运", "感情", "人际", "健康", "学业"] as const;

export function DailyFortuneCard({ fortune }: { fortune: Fortune }) {
  return (
    <div className="px-5 pt-3 pb-6 space-y-6">
      {/* Header content 由 AppHeader 提供，本组件不重复 */}

      {/* HERO: 圆环分数 */}
      <div className="text-center space-y-2">
        <p className="text-[12px] text-ink-fade tracking-ritual font-serif">
          清晨好，{fortune.nickname}
        </p>
        <p className="text-[15px] text-accent-plum font-serif tracking-ritual leading-relaxed max-w-xs mx-auto">
          {fortune.oneLiner}
        </p>
        <div className="relative w-[180px] h-[180px] mx-auto mt-4">
          <WatercolorDot color="lavender" size={32} className="absolute -top-2 left-1/2 -translate-x-1/2" />
          <ScoreRing score={fortune.overall} />
          <Sparkle size={10} variant="asterisk" className="absolute top-2 left-3" />
          <Sparkle size={10} variant="asterisk" className="absolute bottom-3 right-4" />
        </div>
      </div>

      {/* 7 维度条 */}
      <GlassCard className="p-5 space-y-2">
        {DIMS.map((d) => {
          const v = fortune.scores[d] ?? 60;
          return (
            <div key={d} className="flex items-center gap-3">
              <span className="text-[10px] text-ink-fade tracking-ritual w-8 font-sans">{d}</span>
              <div className="flex-1 h-1.5 rounded-full bg-accent-lavender/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-lavender to-wuxing-fire"
                  style={{ width: `${v}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-mist num-mono w-7 text-right">{v}</span>
            </div>
          );
        })}
      </GlassCard>

      {/* 幸运属性 2x3 */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { k: "幸运色", v: fortune.attributes.color },
          { k: "幸运方位", v: fortune.attributes.direction },
          { k: "幸运时辰", v: fortune.attributes.hour },
          { k: "幸运数", v: fortune.attributes.number },
          { k: "幸运花", v: fortune.attributes.flower },
          { k: "随身物", v: fortune.attributes.item },
        ].map((a) => (
          <GlassCard key={a.k} className="p-3 relative">
            <Sparkle size={9} className="absolute top-2 left-2" />
            <p className="text-[10px] text-ink-fade tracking-ritual">{a.k}</p>
            <p className="text-[14px] text-ink-plum font-serif tracking-ritual mt-1">{a.v}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg viewBox="0 0 180 180" className="w-full h-full">
      <defs>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9A1D9" />
          <stop offset="100%" stopColor="#F0B8C8" />
        </linearGradient>
      </defs>
      <circle cx="90" cy="90" r={r} fill="rgba(255,255,255,0.5)" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(196,186,221,0.3)" strokeWidth="4" />
      <circle
        cx="90" cy="90" r={r} fill="none"
        stroke="url(#ring)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform="rotate(-90 90 90)"
      />
      <text x="90" y="92" textAnchor="middle" dominantBaseline="middle"
        className="font-serif fill-ink-plum" style={{ fontSize: 52, letterSpacing: "0.05em" }}>
        {score}
      </text>
      <text x="90" y="118" textAnchor="middle" className="fill-ink-fade font-sans" style={{ fontSize: 10, letterSpacing: "0.4em" }}>
        综合运势
      </text>
    </svg>
  );
}
```

- [ ] **Step 3: 把 D5 首页的占位 import 替换成本卡**

- [ ] **Step 4: 真机（Chrome DevTools iPhone 12 Pro 390×844）预览**

确认：
- [ ] 圆环居中，分数 52px serif 不溢出
- [ ] 7 维度条不挤；色阶柔和不刺眼
- [ ] 6 卡片 2x3 等宽，间距统一

- [ ] **Step 5: 视觉走查（对照 §1）**

逐项核对设计文档 §1 BACKGROUND/COLOR/TYPOGRAPHY/SPACING/CORNERS 全部小项。如有 ≥30% 视觉偏差点，修后再走一遍。截图保存到 `docs/superpowers/specs/visual-baseline/home.png`。

- [ ] **Step 6: Commit**

```bash
git add components/DailyFortuneCard.tsx app/page.tsx
git commit -m "feat(fortune): DailyFortuneCard 素笺仙气视觉实装"
```

---

### Task D7: `/fortune/[date]` FortuneDetail 详情页（素笺仙气 §11）

**Files:**
- Create: `app/fortune/[date]/page.tsx`
- Create: `app/fortune/[date]/_components/FortuneDetailHero.tsx`
- Create: `app/fortune/[date]/_components/DimensionTabs.tsx`
- Create: `app/fortune/[date]/_components/AttributeGroup.tsx`

> **背景：** spec 第 6.1 节明确 `/fortune/[date]` 单日详情在 V1.0 范围（周/月切换在 V1.1）。设计文档 §11 已出 prompt。本任务做单日详情：点击首页运势卡 → 跳到本页查看 7 维度长解读 + 属性扩展说明。

- [ ] **Step 1: page.tsx — RSC 读 fortunes 表**

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile/current";
import { FortuneDetailHero } from "./_components/FortuneDetailHero";
import { DimensionTabs } from "./_components/DimensionTabs";
import { AttributeGroup } from "./_components/AttributeGroup";
import { AppHeader } from "@/components/layout/AppHeader";
import Link from "next/link";

export default async function FortuneDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { data: fortune } = await supabase
    .from("fortunes")
    .select("*")
    .eq("profile_id", profile.id)
    .eq("fortune_date", date)
    .maybeSingle();

  if (!fortune) {
    // 当日未生成 → 触发生成 API（仅当 date === today 时才生成；过去日期返回 not found）
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) notFound();
    // POST 触发生成
    await fetch(new URL("/api/fortune/daily", process.env.NEXT_PUBLIC_SITE_URL!).toString(), { method: "POST" });
    return redirect(`/fortune/${date}`);
  }

  const { date: prev, next } = neighbors(date);

  return (
    <>
      <AppHeader
        title={formatDateChinese(date)}
        left={<Link href="/" className="text-ink-fade text-xl">←</Link>}
      />
      <div className="px-5 py-6 space-y-6">
        <FortuneDetailHero fortune={fortune} />
        <DimensionTabs scores={fortune.scores as any} readings={fortune.readings as any} />
        <AttributeGroup attributes={fortune.attributes as any} />
        <DateNav prev={prev} next={next} />
      </div>
    </>
  );
}

function neighbors(date: string) {
  const d = new Date(date);
  const dPrev = new Date(d); dPrev.setDate(d.getDate() - 1);
  const dNext = new Date(d); dNext.setDate(d.getDate() + 1);
  return {
    date: dPrev.toISOString().slice(0, 10),
    next: dNext.toISOString().slice(0, 10),
  };
}

function formatDateChinese(date: string) {
  // V1.0 简化：直接用 yyyy-mm-dd；V1.1 用 lunar-javascript 算 "丙午年 · 三月初七 · 谷雨"
  return date;
}

function DateNav({ prev, next }: { prev: string; next: string }) {
  return (
    <div className="flex justify-between items-center text-[13px] text-ink-fade tracking-ritual font-serif pt-4">
      <Link href={`/fortune/${prev}`}>← 昨日</Link>
      <Link href={`/fortune/${next}`}>明日 →</Link>
    </div>
  );
}
```

- [ ] **Step 2: FortuneDetailHero — 220px 大圆环 + AI 一句话**

```tsx
import { GlassCard, WatercolorDot, Sparkle } from "@/components/su";
import type { Database } from "@/types/database";

type Fortune = Database["public"]["Tables"]["fortunes"]["Row"];

export function FortuneDetailHero({ fortune }: { fortune: Fortune }) {
  return (
    <section className="text-center space-y-3">
      <div className="relative w-[220px] h-[220px] mx-auto">
        <WatercolorDot color="lavender" size={40} className="absolute -top-3 left-1/2 -translate-x-1/2" />
        <BigScoreRing score={fortune.score_overall ?? 60} />
        <Sparkle size={14} variant="asterisk" className="absolute top-3 left-4" />
        <Sparkle size={14} variant="asterisk" className="absolute bottom-4 right-5" />
      </div>
      <p className="text-[16px] text-accent-plum font-serif tracking-ritual leading-relaxed max-w-sm mx-auto">
        {fortune.one_liner}
      </p>
    </section>
  );
}

function BigScoreRing({ score }: { score: number }) {
  const r = 96;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg viewBox="0 0 220 220" className="w-full h-full">
      <defs>
        <linearGradient id="ring-big" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9A1D9" />
          <stop offset="100%" stopColor="#F0B8C8" />
        </linearGradient>
      </defs>
      <circle cx="110" cy="110" r={r} fill="rgba(255,255,255,0.5)" />
      <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(196,186,221,0.3)" strokeWidth="5" />
      <circle cx="110" cy="110" r={r} fill="none"
        stroke="url(#ring-big)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform="rotate(-90 110 110)" />
      <text x="110" y="113" textAnchor="middle" dominantBaseline="middle"
        className="font-serif fill-ink-plum" style={{ fontSize: 64 }}>
        {score}
      </text>
      <text x="110" y="142" textAnchor="middle" className="fill-ink-fade font-sans" style={{ fontSize: 11, letterSpacing: "0.4em" }}>
        综合运势
      </text>
    </svg>
  );
}
```

- [ ] **Step 3: DimensionTabs — 7 个维度切换 + 长解读**

```tsx
"use client";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { GlassCard, Divider } from "@/components/su";

const DIMS = ["综合", "事业", "财运", "感情", "人际", "健康", "学业"] as const;

export function DimensionTabs({
  scores,
  readings,
}: {
  scores: Record<string, number>;
  readings: Record<string, { text: string; do?: string[]; dont?: string[] }>;
}) {
  const [active, setActive] = useState<typeof DIMS[number]>("综合");
  const r = readings[active] ?? { text: "（暂无解读）" };
  return (
    <GlassCard className="p-5 space-y-4">
      <nav className="flex gap-3 overflow-x-auto pb-1">
        {DIMS.map((d) => (
          <button
            key={d}
            onClick={() => setActive(d)}
            className={cn(
              "text-[11px] tracking-ritual font-serif pb-1 transition-colors duration-suit shrink-0",
              active === d ? "text-ink-plum border-b-2 border-accent-lavender" : "text-ink-fade",
            )}
          >
            {d}
          </button>
        ))}
      </nav>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] text-ink-fade tracking-ritual">
          <span>{active}分数</span>
          <div className="flex-1 h-1 rounded-full bg-accent-lavender/15">
            <div className="h-full rounded-full bg-gradient-to-r from-accent-lavender to-wuxing-fire"
              style={{ width: `${scores[active] ?? 60}%` }} />
          </div>
          <span className="num-mono">{scores[active] ?? 60}</span>
        </div>

        <p className="text-[13px] text-ink-plum leading-[1.85] whitespace-pre-wrap font-sans">
          {r.text}
        </p>

        {(r.do?.length || r.dont?.length) && (
          <>
            <Divider />
            <div className="space-y-2">
              <p className="text-[11px] text-ink-fade tracking-ritual font-serif">今日动作</p>
              {r.do?.length && (
                <div>
                  <span className="text-[12px] font-serif text-accent-plum mr-2">宜</span>
                  <span className="text-[13px] text-ink-mist">{r.do.join(" · ")}</span>
                </div>
              )}
              {r.dont?.length && (
                <div>
                  <span className="text-[12px] font-serif text-accent-plum mr-2">不宜</span>
                  <span className="text-[13px] text-ink-mist">{r.dont.join(" · ")}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 4: AttributeGroup — 6 属性 + 一句话解释**

```tsx
import { GlassCard, Sparkle } from "@/components/su";

const ITEMS = [
  { key: "color", label: "幸运色", explain: (v: string) => `今日五行属水，${v}属水之色，能助你心绪平和。` },
  { key: "direction", label: "幸运方位", explain: (v: string) => `${v}方位与今日干支相合，可优先选择。` },
  { key: "hour", label: "幸运时辰", explain: (v: string) => `日柱三合时辰，${v}前后做关键决定为佳。` },
  { key: "number", label: "幸运数", explain: (v: string) => `日柱地支序，遇到 ${v} 是温柔的提示。` },
  { key: "flower", label: "幸运花", explain: (v: string) => `${v}是今日五行的代表，案头一束便好。` },
  { key: "item", label: "随身物", explain: (v: string) => `${v}贴身，可作今日的小护佑。` },
];

export function AttributeGroup({ attributes }: { attributes: Record<string, string> }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[12px] text-ink-fade tracking-ritual font-serif px-1">幸运属性 · 今日</h3>
      {ITEMS.map((it) => {
        const v = attributes[it.key];
        if (!v) return null;
        return (
          <GlassCard key={it.key} className="p-3.5 relative">
            <Sparkle size={9} className="absolute top-3 left-3" />
            <div className="ml-5">
              <p className="text-[10px] text-ink-fade tracking-ritual">{it.label}</p>
              <p className="text-[15px] text-ink-plum font-serif tracking-ritual mt-0.5">{v}</p>
              <p className="text-[11px] text-ink-mist mt-1.5 leading-relaxed">{it.explain(v)}</p>
            </div>
          </GlassCard>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 5: 在首页 DailyFortuneCard 加跳转链接**

修改 `components/DailyFortuneCard.tsx` 把整个圆环包成 `<Link href={\`/fortune/${todayISO}\`}>`，方便用户点进详情。或在卡片底部加一个小字"看完整解读 →"。

- [ ] **Step 6: 手测 + 视觉走查（§11）**

```bash
pnpm dev
# 访问 /fortune/2026-04-26（或 today）
```

逐项核对：
- [ ] 顶部日期导航（昨日 / 明日）
- [ ] 220px 大圆环 + 一句话副标
- [ ] 7 维度 tabs，active 下划线 lavender，inactive 灰
- [ ] 长解读 sans 13px line-height 1.85；今日动作"宜/不宜"两段
- [ ] 6 属性 GlassCard，每张一句解释
- [ ] 背景承自 mist；BottomNav 不出现（可选 hideNav）

截图归档到 `docs/superpowers/specs/visual-baseline/fortune-detail.png`。

- [ ] **Step 7: Commit**

```bash
git add app/fortune/ components/DailyFortuneCard.tsx
git commit -m "feat(fortune): /fortune/[date] FortuneDetail 详情页"
```

**预估工时：** 4h（含视觉走查）

> **注：** D7 的 prompt 输出结构（`readings.do/dont`）需要 `fortune.daily` prompt v2 输出更详细的 JSON。如 P2 D3 v1 prompt 没产出 do/dont，本任务可降级渲染（仅显示 text 段，hide 今日动作）；prompt 升级在 P3 或 V1.1 处理。

---

## Section E — 八字解读（M6）

### Task E1: 落 `bazi.interpret` prompt

**Files:**
- Modify: `db/seed/prompts.sql`

- [ ] **Step 1: append**

```sql
INSERT INTO prompts (key, version, system_prompt, user_prompt_tpl, active) VALUES
('bazi.interpret', 1,
'你是一位亲切的命理顾问。给定用户完整八字排盘，用温暖治愈的语言做解读。

风格:
- 避免宿命论 / 决定论措辞
- 把"劫财/七杀"等术语翻译成用户能懂的日常语言
- 多用"可能倾向于/这种能量通常表现为"等开放式表达
- 禁用 "命中注定 / 无法改变 / 凶神恶煞"

输出 6 段:
1. 整体格局（日主 + 旺衰）
2. 性格底色
3. 事业方向倾向
4. 感情模式
5. 近 5 年大运
6. 一句温柔总结',
'日主: {dayMaster}
四柱: 年{yearGan}{yearZhi} 月{monthGan}{monthZhi} 日{dayGan}{dayZhi} 时{hourGan}{hourZhi}
五行分布: {fiveElements}
十神: {tenGods}
喜用神: {favorableGods}
大运: {luckPillars}

请按 system 要求输出 6 段解读。',
true)
ON CONFLICT (key, version) DO UPDATE SET system_prompt = EXCLUDED.system_prompt, user_prompt_tpl = EXCLUDED.user_prompt_tpl, active = EXCLUDED.active;
```

- [ ] **Step 2: 导入 + Commit**

```bash
psql $SUPABASE_DB_URL -f db/seed/prompts.sql
git add db/seed/prompts.sql
git commit -m "feat(ai): add bazi.interpret prompt v1"
```

---

### Task E2: `/api/divination/bazi` + 对话流接线

**Files:**
- Create: `app/api/divination/bazi/route.ts`
- Modify: `app/chat/_components/ChatWindow.tsx`

- [ ] **Step 1: 写 API（读 bazi_charts → 落 message + divination_record）**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { conversationId, profileId } = await req.json();
  if (!conversationId || !profileId) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: chart } = await supabase.from('bazi_charts').select('*').eq('profile_id', profileId).single();
  if (!chart) return NextResponse.json({ error: 'chart_not_found' }, { status: 404 });

  const { data: message } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: '正在解读你的八字…',
      intent: 'bazi',
    })
    .select()
    .single();

  await supabase.from('divination_records').insert({
    message_id: message!.id,
    type: 'bazi',
    input: { profileId },
    result: chart,
  });

  return NextResponse.json({ messageId: message!.id, chart });
}
```

- [ ] **Step 2: 前端接入**

意图识别 'bazi' → 前端先读当前 `active_profile_id` → 调 POST → 立即调 /api/chat 流式拉 bazi.interpret

- [ ] **Step 3: 手动端到端**

从 `/chat` 输入"帮我看八字" → 流式出 6 段解读

- [ ] **Step 4: 视觉走查（对照 §8 BaziChart）— 八字排盘卡**

如果 P2 此处仅以纯文字流式展示 → V1.0 可接受（spec 没要求 BaziChart 视觉卡上线 V1.0 就强制展示）。**但若要做卡片**，按 §8 规约：

- [ ] 4 柱（年/月/日/时）横向 4 等分，每柱：
  - 上方小 label sans 10px ink-fade（年/月/日/时）
  - 中间 serif 24px 干支大字（甲/子等），干支用墨紫，五行染色用 `wuxing-*` token 打底
  - 下方小 label 显示十神 sans 11px ink-fade
- [ ] 五行计数 mini bars 5 行（金/木/水/火/土），用 wuxing-* 色
- [ ] 大运 row：横向 8 格 pill，每格 age + 干支 mono 数字
- [ ] 容器 `<GlassCard rounded="card">`

如果 V1.0 仅文字，本步骤跳过；BaziChart 视觉卡作为 V1.0.1 增项加入回补清单。

- [ ] **Step 5: Commit**

```bash
git add app/api/divination/bazi/route.ts app/chat/_components/ChatWindow.tsx
git commit -m "feat(bazi): /api/divination/bazi + chat flow"
```

---

## Section F — 梅花易数 W4 部分（prompt + API + UI 静态）

> **前置**：Task C12 gate 通过才进入本 section。不通过则跳过整节。

### Task F1: 落 `meihua.interpret` prompt（含外应分支）

**Files:**
- Modify: `db/seed/prompts.sql`

- [ ] **Step 1: append 完整 prompt**

```sql
INSERT INTO prompts (key, version, system_prompt, user_prompt_tpl, active) VALUES
('meihua.interpret', 1,
'你是一位亲切的梅花易数老师。给定用户的一次起卦的完整推演结果，结合用户问题（和可选的外应信息）做解读。

【风格要求】
- 年轻化、治愈向；像朋友聊天
- 把"凶/相克/体生用(泄气)"转化为"善意提醒/需要留神/会比较耗心力"
- 严禁 "大凶 / 倒霉 / 厄运 / 不吉" 字眼
- 多用类比（把卦象翻译成生活场景）
- 结尾必给可落地建议

【外应归类规则】（若用户给了外应）
- 水：水/液体/雨/哭/流/冷的意象 → 水
- 火：火/热/红/笑/明/亮 → 火
- 木：花/树/绿/风/纸/长条 → 木
- 金：金属/白/声响/刀/圆/硬 → 金
- 土：土/石/黄/厚/静/方 → 土
把外应五行和体用关系结合（如外应生体 = 吉兆加强；外应克体 = 需留神）。

【输出结构】
若 waiying 为空:
  段1. 本卦象意（3-5 句）
  段2. 体用+变化解读（4-6 句，讲体用关系、变卦指向、卦中卦暗示）
  段3. 应期 + 行动建议（2-3 句）
  段4. 末尾一句轻问: "起卦那一刻你周围有没有让你印象深刻的画面、声音或一句话？没有就说"跳过"即可"

若 waiying 有值:
  段0. 外应融合（2-3 句，按归类规则解读外应+体用组合）
  段1. 本卦象意
  段2. 体用+变化解读（融入外应呼应点）
  段3. 应期 + 行动建议
  （末尾不再追问）',
'本卦: {benGuaName} (上{upperWuxing}/下{lowerWuxing}), 卦辞: {benJudgment}
动爻: 第{dongYao}爻, 爻辞: {dongYaoText}
互卦: {huGuaName}
变卦: {bianGuaName}
卦中卦: {guaZhongGuaName}
体用: {ti}={tiWuxing} / {yong}={yongWuxing}, 关系={relation} ({verdict})
应期: {speed}, {timeHint}, 时辰={branchHour}
用户问题: {userQuestion}
外应: {waiying}

请按 system 要求输出解读（注意 waiying 为空时末尾要轻问外应）。',
true)
ON CONFLICT (key, version) DO UPDATE SET system_prompt = EXCLUDED.system_prompt, user_prompt_tpl = EXCLUDED.user_prompt_tpl, active = EXCLUDED.active;
```

- [ ] **Step 2: 导入 + 验证**

```bash
psql $SUPABASE_DB_URL -f db/seed/prompts.sql
psql $SUPABASE_DB_URL -c "SELECT key FROM prompts WHERE active = true;"
# Expected: 至少 6 行（含 meihua.interpret）
```

- [ ] **Step 3: Commit**

```bash
git add db/seed/prompts.sql
git commit -m "feat(ai): add meihua.interpret prompt v1 (档 4 with waiying branch)"
```

---

### Task F2: `/api/divination/meihua` 路由

**Files:**
- Create: `app/api/divination/meihua/route.ts`

- [ ] **Step 1: 写路由**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { castAndAnalyze, type CastInput } from '@/lib/meihua';

export async function POST(req: NextRequest) {
  const { conversationId, method, numbers, userQuestion } = await req.json();
  if (!conversationId || !method || !userQuestion) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 起卦 + 推演
  const input: CastInput = method === 'time'
    ? { method: 'time', castAt: new Date() }
    : { method: 'number', numbers };
  const result = await castAndAnalyze(input);

  // 落消息 + record
  const { data: message } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: `起到一卦：${result.benGua.name}，动爻第 ${result.dongYao} 爻，变 ${result.bianGua.name}`,
      intent: 'meihua',
      metadata: { ui: 'meihua_result' },
    })
    .select()
    .single();

  await supabase.from('divination_records').insert({
    message_id: message!.id,
    type: 'meihua',
    input: { method, raw: input, userQuestion, waiying: null },
    result,
  });

  return NextResponse.json({ messageId: message!.id, result });
}

// 追加 PATCH 用于外应回填 + 触发二次解读
export async function PATCH(req: NextRequest) {
  const { messageId, waiying } = await req.json();
  const supabase = createServerClient();
  const { data: record } = await supabase
    .from('divination_records')
    .select('*')
    .eq('message_id', messageId)
    .single();
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await supabase
    .from('divination_records')
    .update({ input: { ...record.input, waiying } })
    .eq('id', record.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 手动 curl**

```bash
curl -X POST http://localhost:3000/api/divination/meihua \
  -H "Content-Type: application/json" -H "Cookie: $COOKIE" \
  -d '{"conversationId":"<id>","method":"number","numbers":[3,5],"userQuestion":"最近运气怎样"}'
```
Expected: 返回 `{messageId, result: {benGua, huGua, bianGua, guaZhongGua, dongYao, tiYong, yingQi, meta}}`

- [ ] **Step 3: 手动 PATCH（外应回填）**

```bash
curl -X PATCH http://localhost:3000/api/divination/meihua \
  -d '{"messageId":"<id>","waiying":"打翻了水杯"}'
```
Expected: `{ok: true}`；Supabase 里 `divination_records.input.waiying = "打翻了水杯"`

- [ ] **Step 4: Commit**

```bash
git add app/api/divination/meihua/route.ts
git commit -m "feat(meihua): POST + PATCH /api/divination/meihua"
```

---

### Task F3: `<MeihuaInputCard>` 起卦方式选择器（静态样式）

**Files:**
- Create: `app/chat/_components/MeihuaInputCard.tsx`

- [ ] **Step 1: 写组件（两个亮 + 三个灰）**

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

type Method = 'time' | 'number';

interface Props {
  onSubmit: (args: { method: Method; numbers?: number[] }) => void;
}

export function MeihuaInputCard({ onSubmit }: Props) {
  const [picked, setPicked] = useState<Method | null>(null);
  const [n1, setN1] = useState(''); const [n2, setN2] = useState(''); const [n3, setN3] = useState('');

  if (picked === 'time') {
    onSubmit({ method: 'time' });
    return null;
  }

  if (picked === 'number') {
    const numbers = [n1, n2, n3].filter(Boolean).map(Number).filter(n => Number.isInteger(n) && n > 0);
    return (
      <Card className="p-4 my-2">
        <div className="mb-2 font-medium">输入 1–3 个正整数</div>
        <div className="flex gap-2">
          <Input type="number" value={n1} onChange={e => setN1(e.target.value)} placeholder="第1个" />
          <Input type="number" value={n2} onChange={e => setN2(e.target.value)} placeholder="第2个（可空）" />
          <Input type="number" value={n3} onChange={e => setN3(e.target.value)} placeholder="第3个（可空）" />
        </div>
        <Button
          className="mt-3 w-full"
          disabled={numbers.length === 0}
          onClick={() => onSubmit({ method: 'number', numbers })}
        >起卦</Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 my-2">
      <div className="mb-3 font-medium">选择起卦方式</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setPicked('time')}>时间起卦（推荐）</Button>
        <Button variant="outline" onClick={() => setPicked('number')}>数字起卦</Button>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        <div className="grid grid-cols-3 gap-2 opacity-50 cursor-not-allowed">
          <div className="p-2 border rounded text-center">报数起卦</div>
          <div className="p-2 border rounded text-center">文字起卦</div>
          <div className="p-2 border rounded text-center">摇铜钱</div>
        </div>
        <div className="text-center mt-2">V1.0.5 敬请期待</div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: 在 Storybook 或 `/chat` 临时测试页插入看样式**

确认 2 个按钮可点，3 个占位显示灰色 + 小字说明。

- [ ] **Step 3: 视觉走查（对照 §5 MeihuaInputCard）**

- [ ] 容器换 `<GlassCard rounded="card">`，padding 16×14
- [ ] Header row "选 择 起 卦 方 式" serif 13px 墨紫 `tracking-ritual`，右侧 `<Sparkle size={10} />`
- [ ] 主按钮 56px 高 `rounded-[12px]`，淡紫粉渐变 over white；副 label "此刻之兆" / "一 / 二 / 三 个数" sans 10px ink-fade
- [ ] 主按钮含小 icon（时间用 clock outline 1.5px 笔画 lavender；数字用 # hash 同色）
- [ ] 3 个 V1.0.5 占位是 dashed border pill 10px 文字，下方 hint "V1.0.5 敬请期待 ✧"
- [ ] 选数字起卦后展开：3 个 56px 方形 input，center-aligned serif 22px，`rounded-[12px]` lavender border
- [ ] 提交按钮 `rounded-[12px]` 淡紫粉渐变 + serif 14px white `tracking-ritual` + 微 glow

差异 ≥80% 通过；截图归档。

- [ ] **Step 4: Commit**

```bash
git add app/chat/_components/MeihuaInputCard.tsx
git commit -m "feat(meihua): MeihuaInputCard 素笺仙气版 + V1.0.5 占位"
```

---

### Task F4: `<MeihuaResultCard>` 4 宫格卦象卡（静态样式）

**Files:**
- Create: `app/chat/_components/MeihuaResultCard.tsx`

- [ ] **Step 1: 写组件**

```tsx
'use client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// 八卦 Unicode: 乾☰ 兑☱ 离☲ 震☳ 巽☴ 坎☵ 艮☶ 坤☷
const TRIGRAM_SYMBOL: Record<string, string> = {
  乾: '☰', 兑: '☱', 离: '☲', 震: '☳', 巽: '☴', 坎: '☵', 艮: '☶', 坤: '☷',
};

const WUXING_BG: Record<string, string> = {
  金: 'bg-gray-50 border-gray-300',
  木: 'bg-green-50 border-green-300',
  水: 'bg-blue-50 border-blue-300',
  火: 'bg-red-50 border-red-300',
  土: 'bg-yellow-50 border-yellow-300',
};

interface Hexagram {
  name: string;
  upper_trigram: string;
  lower_trigram: string;
  upper_wuxing: string;
  lower_wuxing: string;
}

interface Result {
  benGua: Hexagram;
  huGua: Hexagram;
  bianGua: Hexagram;
  guaZhongGua: Hexagram;
  dongYao: number;
  tiYong: { ti: 'upper' | 'lower'; yong: 'upper' | 'lower'; tiWuxing: string; yongWuxing: string; verdict: string; relation: string };
  yingQi: { speed: string; timeHint: string; branchHour: string };
}

function GuaCell({ title, g }: { title: string; g: Hexagram }) {
  return (
    <div className={cn('p-3 border rounded text-center', WUXING_BG[g.upper_wuxing])}>
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-2xl my-1">{TRIGRAM_SYMBOL[g.upper_trigram]}</div>
      <div className="text-2xl">{TRIGRAM_SYMBOL[g.lower_trigram]}</div>
      <div className="font-medium mt-1 text-sm">{g.name}</div>
      <div className="text-xs opacity-60">{g.upper_wuxing}/{g.lower_wuxing}</div>
    </div>
  );
}

export function MeihuaResultCard({ result }: { result: Result }) {
  const verdictColor = result.tiYong.verdict === '吉' ? 'text-green-600' : result.tiYong.verdict === '凶' ? 'text-red-600' : 'text-gray-600';
  return (
    <Card className="p-4 my-3">
      <div className="text-center font-medium mb-3">你抽到的梅花卦</div>
      <div className="grid grid-cols-4 gap-2">
        <GuaCell title="本卦" g={result.benGua} />
        <GuaCell title="互卦" g={result.huGua} />
        <GuaCell title="变卦" g={result.bianGua} />
        <GuaCell title="卦中卦" g={result.guaZhongGua} />
      </div>
      <div className="mt-3 pt-3 border-t text-sm space-y-1">
        <div>★ 动爻: 第 {result.dongYao} 爻</div>
        <div>体: {result.tiYong.ti === 'upper' ? '上卦' : '下卦'}({result.tiYong.tiWuxing}) · 用: {result.tiYong.yong === 'upper' ? '上卦' : '下卦'}({result.tiYong.yongWuxing})</div>
        <div className={cn('font-medium', verdictColor)}>{result.tiYong.relation} — {result.tiYong.verdict}</div>
        <div>☷ 应期: {result.yingQi.timeHint}（{result.yingQi.branchHour}）</div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: 把 Card 接入 MessageList 分发**

修改 `app/chat/_components/MessageList.tsx`，加分支：

```tsx
{message.metadata?.ui === 'meihua_result' && message.meihuaResult && (
  <MeihuaResultCard result={message.meihuaResult} />
)}
```

（前端拉 messages 时，需要同时 join `divination_records` 拿 `result`。在对话加载 SQL 里用 `messages + divination_records` 联表 select。）

- [ ] **Step 3: 手动验证**

`/chat` → 用上一节 F2 的 API 造一条 meihua 消息 → 看 4 宫格渲染正确，颜色按五行区分

- [ ] **Step 4: 真机预览**

iPhone 12 Pro 视口（390×844）：确认 4 宫格不挤，字号够大

- [ ] **Step 5: 视觉走查（对照 §6 MeihuaResultCard 已定 mockup）**

参考文件：`docs/superpowers/designs/meihua-result-card-20260424/a-refined-fairy.html`（**最终规格**）。

逐项核对：
- [ ] 4 宫格卦象 unicode 大字 ☰☱☲☳☴☵☶☷ 用 `text-accent-bagua`（雾紫灰）
- [ ] 每格按上下卦五行染色（金白/木青/水蓝/火红/土黄 用 `wuxing-*` token）
- [ ] 体/用 标签高亮（体 = ti_yong.ti 那一格，淡紫粉描边）
- [ ] 动爻位用一个小 lavender 圆点标在对应宫格右上
- [ ] 应期提示小字底部 sans 10px ink-fade `tracking-ritual`
- [ ] 容器 `<GlassCard rounded="card">` + lavender hairline + shadow-glass

把实装结果在浏览器开 `a-refined-fairy.html` 并排对照；像素级偏差 > 30% 修后再走。

- [ ] **Step 6: Commit**

```bash
git add app/chat/_components/MeihuaResultCard.tsx app/chat/_components/MessageList.tsx
git commit -m "feat(meihua): MeihuaResultCard 素笺仙气 4 宫格"
```

---

## Section G — P2 结束检查（Definition of Done）

### Task G1: P2 完结检查清单

- [ ] **Step 1: 跑所有单测**

Run: `pnpm vitest run`
Expected: 0 failing，lib/ 下覆盖率 >= 80%

- [ ] **Step 2: 手动走 5 条完整用户路径**

- 路径1 抽签: `/chat` → "我要抽灵签" → 选主题 → 问问题 → 看签文卡 → 看 AI 流式 → 通过
- 路径2 解梦: `/chat` → "帮我解个梦" → 描述梦 → 看 AI 三视角解读 → 通过
- 路径3 首页运势: `/` → 看运势卡 → 刷新（验证缓存命中） → 通过
- 路径4 八字解读: `/chat` → "帮我看八字" → 看 6 段解读 → 通过
- 路径5 梅花易数（若 gate 通过，**P2 范围限定版本**）：
  - 算法层：`pnpm tsx scripts/verify-meihua-cases.ts` 跑通 5 案例（C12 朋友验收已过）
  - API 层：直接 curl `/api/divination/meihua` 起卦 → 返回 `{recordId, result}` JSON 含 4 宫格
  - UI 层：在临时测试页或对话页插一条 `metadata.ui='meihua_result'` 的 message → MeihuaResultCard 4 宫格渲染正确（五行染色 + 体用高亮 + 应期底栏）
  - Prompt 层：用 result 手动填进 `meihua.interpret` user template，curl `chat()` API 看流式输出 3 段是否合理
  - **跳过**：完整对话流接线（自动追问 + 流式解读卡 + 末尾外应轻问 + 二次融合）— 这部分实现在 P3 I4/J1/J2，W5 才接通。完整 5 路径回归归到 **P3 N1**。

- [ ] **Step 3: 检查 DB 状态**

Run:
```bash
psql $SUPABASE_DB_URL -c "SELECT type, COUNT(*) FROM divination_records GROUP BY type;"
```
Expected: 看到 qianwen/dream/bazi (和 meihua，若 gate 通过) 各有 >= 1 行测试数据

- [ ] **Step 4: 清理测试数据**

```bash
psql $SUPABASE_DB_URL -c "DELETE FROM messages WHERE content LIKE '%测试%';"
psql $SUPABASE_DB_URL -c "DELETE FROM divination_records WHERE created_at > now() - interval '1 day';"
```

- [ ] **Step 5: P2 合并到 main（若在 branch）**

```bash
git checkout main
git merge --no-ff p2-features -m "feat: P2 complete — 5 功能闭环（抽签/解梦/首页运势/八字/梅花 V1.0）"
git push origin main
```

- [ ] **Step 6: P2 完结记录**

在 `docs/superpowers/specs/2026-04-24-qingyun-ai-design.md` 顶部修订摘要加一行：

```md
- 2026-MM-DD: P2（W3-W4 功能期）完成，5 功能闭环走通，梅花 W3 gate [通过/降级到 V1.0.1]
```

Commit 这一行更新。

---

## Self-Review Checklist

运行以下检查（结果填回本文档末尾表格）：

1. **Spec 覆盖**：spec 的 M2/M4/M5/M6/M7 五个闭环各自对应本计划哪些 Section？
   - M2 首页运势 → Section D（D1–D6 + **D7 `/fortune/[date]` 详情**）
   - M4 抽签 → Section A
   - M5 解梦 → Section B
   - M6 八字解读 → Section E
   - M7 梅花易数 V1.0 → Section C + F（含 W3 gate）

2. **Placeholder 检查**：搜 "TODO" / "TBD" / "待定"
   - 自审后已清理全部 TODO；保留 "V1.0.5 未实现桩" 的描述是刻意的设计（桩函数主动 throw，非 plan 占位符）

3. **类型/方法签名一致性**：
   - `castAndAnalyze(input)` 在 C11 定义，F2 消费 — 签名一致（参数 CastInput / 返回 CastResult）
   - `computeDailyScore(chart, date)` 在 D1 定义，D4 消费 — 签名一致
   - `pickSlip(opts?)` 在 A3 定义，A4 消费 — 签名一致
   - `judgeTiYong` / `computeYingQi` 在 C9/C10 定义，C11 消费 — 签名一致

4. **依赖顺序**：Section C （算法）必须先于 Section F （UI/prompt），已通过 gate 任务 C12 显式隔离；A/B/D/E 互相独立，可交替

5. **V1.0.5 预留**：Task C7 的 3 个桩文件 + F3 的灰色占位 UI —— 两处对齐

6. **W3 末硬 gate**：Task C12 明确定义验收标准、降级路径、文档产出

7. **视觉系统覆盖**（2026-MM-DD 增补）：
   - 沿用 P1 Section S 已建素笺仙气 token + 仙气原子 + AppShell
   - A6（SlipResultCard）+ E2（BaziChart）+ F3（MeihuaInputCard）+ F4（MeihuaResultCard）+ D6（DailyFortuneCard）+ D7（FortuneDetail）任务末尾全部加视觉走查步骤
   - 设计文档 14 单元在 P1 + P2 + P3 完整覆盖（详见 P1 顶部页面排期矩阵）

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-24-qingyun-ai-p2-features.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 每个 Task 派一个 fresh subagent（适合 C1–C11 这类纯算法单测密集任务），Section A/B/D/E/F 的 API/UI 任务可串执行也可并行（多个独立 Section）。评审在 Task 之间进行。

**2. Inline Execution** — 在当前会话里按 Section 顺序批量执行，每个 Section 结束做一次 checkpoint review。

**Which approach?**

---

## P1（骨架期）+ P3（上线期）计划 · 占位

**P1（W1–W2）未来产出**：
- Next.js + Supabase 初始化 / 所有表 + RLS / 匿名登录
- lunar-javascript 封装 + 八字算法 + 单测
- 档案 onboarding 3 步表单
- AI Gateway + prompts 表结构 + 意图路由规则层（含 meihua 关键词）
- `/api/chat` SSE + 对话页基础 UI + 历史记录

**P3（W5 + V1.0.5）未来产出**：
- 梅花对话流接线（MeihuaInputCard → API → ResultCard → AI 流式 → 外应轻问 → 外应融合）
- 敏感词过滤全量升级（含梅花用户问题）/ 错误边界 / PWA + manifest / 微信真机测 / Plausible 埋点 / Vercel 部署
- **V1.0.5（上线后 2-3 周）**：报数起卦、文字起卦（笔画字典）、摇铜钱起卦 + Lottie 动画；`MeihuaInputCard` 解锁 3 个灰色占位
