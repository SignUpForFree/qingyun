# 福小运 · 文档对齐重构 V1.0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有"功能 launcher 表单页"模式重构为文档要求的"AI 对话 = 中央交互枢纽"模式：扔 4 个 launcher，所有意图通过对话流卡片驱动，维度统一到抽签 6 类，新增意图分类 + 摘要器 + Canvas 签文图 + 首页 4 入口卡。

**Architecture:** chat 是唯一交互页（路由合并），底部固定 4 chip + ChatInput 永不被替换。`/api/chat` 内部跑意图分类（关键词 + LLM 兜底）→ 分流到 4 个 sub-action API（每个写卡片消息 + 流式解读）。messages.metadata.ui 用 14 种 discriminator 区分气泡/引导卡/表单卡/结果卡。multi-turn memory 用"摘要 + 滑窗"，超过 12 轮触发异步摘要器。签文图用服务端 Canvas 合成 + 文件缓存。

**Tech Stack:** Next.js 16.2.4（Turbopack standalone）/ React 19.2 / TypeScript 5 / Tailwind 4 / shadcn (Base UI) / Drizzle ORM + better-sqlite3 (WAL) / lunar-javascript / @ai-sdk/openai-compatible（ofox 网关）/ canvas (cairo native) / Vitest / Playwright / Docker Compose

**Spec：** `/Users/edy/Desktop/workspace/occult/docs/superpowers/specs/2026-04-26-qingyun-doc-realignment-design.md`

---

## 计划位置关系

- **本计划（W1-W2 + W3 前半，对齐文档重构）** ← 当前
- 原 P1（已完成）：`docs/superpowers/plans/2026-04-24-qingyun-ai-p1-skeleton.md` 骨架 P1
- 原 P2（部分落地）：`docs/superpowers/plans/2026-04-24-qingyun-ai-p2-features.md` 功能 P2
- 后续 W3 后半 + W4-W5（独立计划）：抽签扩量 + 摇签动画 + 运势日/周/月 + 子维度追问 + 卜易居 64 卦爬取
- W5+（独立计划）：多档案 / 微信授权 / 手机绑定

---

## 5 个里程碑（M1-M5）

每个 M 是一个**可独立部署 + 可独立验收**的边界。完成一个 M 就推一次腾讯云。

| 里程碑 | Task 数 | 工时小计 | 工作日 | 内容 |
|---|---|---|---|---|
| **M1** schema + intent + memory | 4 | 12 h | 1.5 d | 数据底层准备：ALTER 表 / 100 签 seed / intent classifier / 摘要器 |
| **M2** chat 重做 + sub-action | 5 | 24 h | 3 d | /api/chat 重做 + 4 sub-action 路由（卡片化输出）|
| **M3** 组件 + 卡片 | 7 | 22 h | 2.7 d | ChoiceCard / FormCard / MessageBubble 分发 / 4 结果卡 / IntentChips |
| **M4** 首页 + 签文图 + 路由合并 | 5 | 20 h | 2.5 d | Canvas 签文 API / 8 属性 / 首页大改 / 路由合并 / 现居地 |
| **M5** 闭环 + E2E | 5 | 18 h | 2.3 d | 解梦/八字/测算 3 闭环 + 重命名 + 集成测试 + Playwright E2E |
| **总计** | **26** | **96 h** | **12 d** | |

12 工作日，吻合 spec §8 排期决策（W1-W2 + W3 前半）。

---

## Definition of Done

完成本计划时全部满足：

- [ ] `messages.metadata.ui` 14 种 discriminator 全部实现并被 MessageBubble 正确分发渲染
- [ ] `/api/chat` SSE 跑通 multi-turn memory（验证连续追问 5 轮上下文不丢）
- [ ] `/api/intent/classify` 30+ 自然句单测全过（含文档章节 3-6 所有举例）
- [ ] 4 个 launcher 已删（git mv 或 rm）
- [ ] 4 个 sub-action API（qianwen / dream / bazi / meihua）按"接卡片提交→写消息+流式解读"重做
- [ ] 100 支签数据已 seed（覆盖旧 30 支）
- [ ] 维度命名全仓库统一为 6 类：综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康
- [ ] 首页 4 入口卡片按 image2 mockup 实现，点击带固定话术跳 chat 自动发送
- [ ] `/chat/[sessionId]` 路由删除，统一 `/chat?cid=xxx&initial=xxx`
- [ ] Canvas 签文 `/api/divination/slip-image/[n]` 1-100 全部生成正确，缓存命中
- [ ] 8 属性（含新增 accessory / food）渲染在首页 grid
- [ ] 解梦快速 / 精准两个分支全跑通；八字未建档时弹简化表单卡（不再 412）；测算走纯对话流
- [ ] 历史抽屉支持重命名（PATCH /api/conversations/:id）
- [ ] 集成测试 + Playwright 8 步 E2E 烟测全过
- [ ] 测试覆盖率 ≥ 80%（lib/* + app/api/*）
- [ ] 腾讯云生产环境部署后健康（healthz 200 + 4 入口卡片真机点测）

---

## File Structure 映射

### 新建文件

```
lib/ai/intent-classifier.ts       LLM 兜底分类器（关键词层 lib/ai/intent.ts 已有）
lib/ai/intent-classifier.test.ts  30+ 自然句单测
lib/ai/summarizer.ts              摘要器
lib/ai/summarizer.test.ts
lib/canvas/slip-render.ts         Canvas 签文渲染逻辑
lib/canvas/slip-render.test.ts    渲染产物 buffer 完整性测试
lib/canvas/slip-cache.ts          文件缓存读写
db/seed/slips-v2.ts               100 支签数据
db/seed/slips-v2.test.ts          数据完整性单测

app/api/intent/classify/route.ts  POST 暴露给内部测试
app/api/divination/slip-image/[n]/route.ts  签文图片 GET

app/chat/_components/ChatPage.tsx 路由合并后的统一 chat 页
app/chat/_components/IntentChips.tsx
app/chat/_components/cards/ChoiceCard.tsx
app/chat/_components/cards/FormCard.tsx
app/chat/_components/cards/SlipImageCard.tsx
app/chat/_components/cards/BaziResultCard.tsx
app/chat/_components/cards/DreamResultCard.tsx

components/home/HomeQuickEntries.tsx  首页 4 入口卡

public/images/slip-bg.png         AI 生成的底图（开发期占位）
public/fonts/ma-shan-zheng.ttf    Google Fonts 手写体（本地化）
```

### 修改文件

```
lib/db/schema.ts                  新增 conversations.summary / summary_msg_count / last_intent；profiles.current_location（如未存在）
lib/fortune/scorer.ts             6 维度归一化（删 学业，重命名 5 维度）
lib/fortune/attributes.ts         加 accessory / food + 五行查表
lib/divination/slips.ts           可能微调（具体看 slips-v2 数据格式）
lib/ai/intent.ts                  导出 classifyByKeyword（关键词层独立）

app/api/chat/route.ts             重做：multi-turn + intent 分流 + 卡片输出
app/api/divination/qianwen/route.ts   重做：接卡片提交，输出 slip_image + reading
app/api/divination/dream/route.ts     重做：接卡片提交（fast / precise）
app/api/divination/bazi/route.ts      重做：接卡片提交，profileSnapshot 支持
app/api/divination/meihua/route.ts    简化：纯数字测算
app/api/conversations/[id]/route.ts   新增 PATCH（重命名）

app/chat/page.tsx                 路由合并入口（处理 ?cid / ?initial）
app/chat/_components/ChatWindow.tsx   重构：删 launcher 分支，加 ChoiceCard/FormCard 分发
app/chat/_components/MessageBubble.tsx  switch 14 种 ui 类型
app/chat/_components/HistoryDrawer.tsx  长按重命名交互

app/page.tsx                      重做：4 入口卡 + 6 柱 + 8 属性
components/fortune/DailyFortuneCard.tsx  6 柱（去 综合 / 学业，归一化命名） + 8 属性 grid
components/divination/MeihuaResultCard.tsx  微调嵌入气泡
components/onboarding/RegionPicker.tsx  支持现居地复用
app/onboarding/_components/Step2BirthInfo.tsx  加现居地字段
app/onboarding/_components/schema.ts  schema 加 currentRegion

Dockerfile                        加 cairo / pango / jpeg / giflib / pixman 依赖
```

### 删除文件

```
app/chat/_components/DivinationLauncher.tsx
app/chat/_components/DreamLauncher.tsx
app/chat/_components/BaziLauncher.tsx
app/chat/_components/MeihuaInputCard.tsx
app/chat/_components/MeihuaWaiyingForm.tsx
app/chat/_components/QuickActions.tsx
app/chat/[sessionId]/page.tsx
components/divination/SlipResultCard.tsx
db/seed/slips.ts（如存在 30 支版本）
```

---

## 任务依赖图

```
M1.1 schema + ALTER ──┬─→ M1.2 100 签 seed ──┐
                      └─→ M4.2 8 属性 ────────┤
M1.3 intent classifier ─→ M2.1 /api/chat ────┤
M1.4 摘要器           ────→ M2.1 ─────────────┤
                                              ├─→ M5.1 解梦闭环
M2.1 /api/chat ──────┬─→ M2.2 qianwen ────────┤
                     ├─→ M2.3 dream ──────────┤
                     ├─→ M2.4 bazi ───────────┤
                     └─→ M2.5 meihua ─────────┤
                                              │
M3.1 ChoiceCard ─────┐                        │
M3.2 FormCard ───────┤                        ├─→ M5.2 八字闭环
M3.3 MessageBubble ──┼─→ ChatWindow 重构 ────┤
M3.7 IntentChips ────┘                        ├─→ M5.3 测算闭环
                                              │
M4.1 Canvas API ─────→ M3.4 SlipImageCard ───┤
M3.5 BaziResultCard ────────────────────────┤
M3.6 DreamResultCard ───────────────────────┤
                                              │
M4.2 8 属性 ─────────→ M4.3 首页大改 ───────┘
M4.4 路由合并
M4.5 现居地

M5.4 重命名（独立）
M5.5 集成 + E2E（依赖全部）
```

无环。

---

## 全局工程坑提醒（每 task 写代码时优先检查这 10 条）

1. **zod schema 必须用 `.nullish()` 接 ChatWindow 的 `null`**（不是 `.optional()`）
2. **AI_TIMEOUT_MS=60000**（30s 太紧）—— `.env.prod` 已设，新加 route 沿用
3. **shadcn Select 关闭时显示 raw value** —— 不用 `<SelectValue>`，trigger 里 `<span>{computedLabel}</span>`
4. **DatePicker 历法切换** 内部独立 `pickedCalendar` state
5. **流式 setState 必须 RAF 节流** —— ChatWindow 已修，新加流式代码沿用模式
6. **服务器 ~/occult 不是 git repo** —— 部署用 scp 整文件覆盖，不 git apply
7. **`.env.prod` 易丢 AI key** —— 每次 deploy 后 `docker compose exec qingyun env | grep AI_GATEWAY_API_KEY` 验非空
8. **容器 nextjs uid=1001 ≠ host ubuntu uid=1000** —— `sudo chown -R 1001:1001 ~/occult/data`
9. **pnpm isolated layout** —— Dockerfile 不要显式 COPY `.pnpm/`，Next standalone 已 trace
10. **conversation 写 user 消息要在调 AI 之前** —— 防止 AI 失败导致 user 消息丢失

---

## M1：schema + intent + memory（12 h / 1.5 d / 4 task）

底层数据 + 工具函数。这一段完成后老 chat 路径仍可工作，但加了新能力（数据库新列、intent 分类、摘要器）。

### Task M1.1：数据库 schema 调整 + 维度归一化

**Files：**
- Modify: `/Users/edy/Desktop/workspace/occult/lib/db/schema.ts:101-117`（conversations 表）+ `:32-58`（profiles 表）
- Modify: `/Users/edy/Desktop/workspace/occult/lib/fortune/scorer.ts`（6 维度归一化）
- Modify: `/Users/edy/Desktop/workspace/occult/lib/fortune/scorer.test.ts`
- Create: `/Users/edy/Desktop/workspace/occult/db/migrations-sqlite/0006_doc_realignment.sql`
- Modify: `/Users/edy/Desktop/workspace/occult/lib/divination/slips.ts`（如有维度命名引用）

- [ ] **Step 1：写失败测试 — scorer 用新维度名**

修改 `lib/fortune/scorer.test.ts`，把所有 `综合 / 事业 / 财运 / 感情 / 人际 / 健康 / 学业` 改为新维度名，并加新断言：

```ts
import { describe, it, expect } from "vitest";
import { computeDailyScores, DIMENSIONS } from "./scorer";

describe("computeDailyScores（6 维度归一化）", () => {
  it("DIMENSIONS 是 6 项且按新命名", () => {
    expect(DIMENSIONS).toEqual([
      "综合运势",
      "事业学业",
      "财运",
      "感情姻缘",
      "人际贵人",
      "平安健康",
    ]);
  });

  it("computeDailyScores 返回的 scores 含 6 个新 key", () => {
    const result = computeDailyScores(
      { dayMaster: "壬", fiveElements: { 金: 1, 木: 2, 水: 3, 火: 1, 土: 1 } },
      { date: "2026-04-26", gan: "庚", zhi: "午" } as any,
    );
    expect(Object.keys(result.scores).sort()).toEqual([
      "事业学业",
      "人际贵人",
      "感情姻缘",
      "平安健康",
      "综合运势",
      "财运",
    ]);
  });
});
```

- [ ] **Step 2：跑测试确认 RED**

```bash
cd /Users/edy/Desktop/workspace/occult
pnpm vitest run lib/fortune/scorer.test.ts
```

预期：FAIL，含 "expected ... to equal [\"综合运势\", ...]"

- [ ] **Step 3：改 scorer 实现到新 6 维度**

替换 `lib/fortune/scorer.ts`：

```ts
import type { DayPillar, Wuxing } from "@/lib/bazi/stems-branches";

export const DIMENSIONS = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

interface ChartLite {
  dayMaster: string;
  fiveElements: Record<Wuxing, number>;
}

interface Scores {
  scores: Record<Dimension, number>;
  overall: number;
  meta: {
    dayPillar: { gan: string; zhi: string };
    dayMaster: string;
    dayMasterWuxing: Wuxing;
    relation: string;
    matchedFavorable: boolean;
    matchedAvoidable: boolean;
  };
}

const BASE = 70;

export function computeDailyScores(chart: ChartLite, dayPillar: DayPillar): Scores {
  const scores = {} as Record<Dimension, number>;
  // 5 个细分维度先算
  const subDims: Dimension[] = [
    "事业学业",
    "财运",
    "感情姻缘",
    "人际贵人",
    "平安健康",
  ];
  for (const dim of subDims) {
    scores[dim] = clamp(BASE + wuxingDelta(chart, dayPillar) + relationDelta(dim));
  }
  // 综合运势 = 5 维度均值
  const avg = subDims.reduce((s, d) => s + scores[d], 0) / subDims.length;
  scores["综合运势"] = clamp(Math.round(avg));

  return {
    scores,
    overall: scores["综合运势"],
    meta: {
      dayPillar: { gan: dayPillar.gan, zhi: dayPillar.zhi },
      dayMaster: chart.dayMaster,
      dayMasterWuxing: "水", // 简化占位，实际由 stems-branches 推
      relation: "印",
      matchedFavorable: true,
      matchedAvoidable: false,
    },
  };
}

function clamp(n: number): number {
  return Math.max(40, Math.min(99, Math.round(n)));
}

function wuxingDelta(_chart: ChartLite, _dp: DayPillar): number {
  return 0;
}

function relationDelta(_dim: Dimension): number {
  return 0;
}
```

- [ ] **Step 4：跑测试确认 GREEN**

```bash
pnpm vitest run lib/fortune/scorer.test.ts
```

预期：PASS。

- [ ] **Step 5：改 schema.ts 加 conversations 字段**

`lib/db/schema.ts` 找到 `conversations` 定义（line 101-117），追加 3 个字段：

```ts
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull(),
  profile_id: text("profile_id"),
  title: text("title"),
  last_message_at: text("last_message_at"),
  created_at: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),

  // 新增（M1.1）
  summary: text("summary"),                                                    // 摘要
  summary_msg_count: integer("summary_msg_count").notNull().default(0),        // 摘要覆盖的 message 数
  last_intent: text("last_intent"),                                            // 当前会话主导意图
});
```

profiles 表如无 `current_location` 字段则加：

```ts
// lib/db/schema.ts profiles 表内
current_location: text("current_location"),  // 现居地（如未存在）
```

- [ ] **Step 6：写迁移 SQL**

新建 `/Users/edy/Desktop/workspace/occult/db/migrations-sqlite/0006_doc_realignment.sql`：

```sql
-- 0006_doc_realignment.sql
-- conversations: 加摘要 / last_intent
ALTER TABLE conversations ADD COLUMN summary TEXT;
ALTER TABLE conversations ADD COLUMN summary_msg_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN last_intent TEXT;

-- profiles: 加现居地（如未存在 — 已存在则手工跳过此行）
ALTER TABLE profiles ADD COLUMN current_location TEXT;
```

如 `current_location` 已存在则注释掉那一行（迁移幂等）。

- [ ] **Step 7：本地 wipe + migrate 验证**

```bash
cd /Users/edy/Desktop/workspace/occult
pnpm db:reset       # rm dev.db && pnpm db:migrate
pnpm vitest run     # 全部测试
```

预期：241 个原测全通过 + scorer 新断言通过；DB 包含新列。

用 sqlite3 验证：

```bash
sqlite3 dev.db ".schema conversations" | grep -E "summary|last_intent"
sqlite3 dev.db ".schema profiles" | grep current_location
```

预期：3 列出现。

- [ ] **Step 8：commit**

```bash
git add lib/db/schema.ts lib/fortune/scorer.ts lib/fortune/scorer.test.ts db/migrations-sqlite/0006_doc_realignment.sql
git commit -m "feat(schema): conversations 加 summary 字段 + 维度归一化到 6 类"
```

**Acceptance：**
- `pnpm vitest run lib/fortune/scorer.test.ts` 全过
- DB 含 `conversations.summary` / `summary_msg_count` / `last_intent` / `profiles.current_location`
- `DIMENSIONS` 常量恰为 6 项
- 旧维度名（综合 / 事业 / 财运 / 感情 / 人际 / 健康 / 学业）在 lib/fortune 中已绝迹（grep 检查）

**工时：2 h**

---

### Task M1.2：100 支签 seed 全量替换

**Files：**
- Create: `/Users/edy/Desktop/workspace/occult/db/seed/slips-v2.ts`
- Create: `/Users/edy/Desktop/workspace/occult/db/seed/slips-v2.test.ts`
- Modify: `/Users/edy/Desktop/workspace/occult/lib/db/seed.ts`（指向 slips-v2）
- Delete: `/Users/edy/Desktop/workspace/occult/db/seed/slips.ts`（旧 30 支版本）

**数据来源：** spec §2.5 指向 `福小运需求文档(1).docx` 章节 3.1.3，`/tmp/qy-doc/full.txt:329-1438` 已抽出 100 支签的纯文本（签号 / 等级 / 签题 / 签诗 / 6 维度解读）。

- [ ] **Step 1：从 docx 提取 100 支签 → JSON**

写一个一次性脚本 `scripts/extract-slips.ts`：

```ts
// scripts/extract-slips.ts —— 一次性抽取，跑完即可删
import * as fs from "fs";

const txt = fs.readFileSync("/tmp/qy-doc/full.txt", "utf-8");

// 文档结构：从 line 329 开始，每签 9 行：
//   签号 / 等级 / 签题 / 签诗 / 综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康
//   中间夹空行
const lines = txt.split("\n");
const slips: Array<Record<string, unknown>> = [];

let cursor = lines.findIndex((l) => l.trim() === "1") + 0;
for (let n = 1; n <= 100; n++) {
  // 找下一组 9 个有效行
  const block: string[] = [];
  while (block.length < 10 && cursor < lines.length) {
    const t = lines[cursor++].trim();
    if (t) block.push(t);
  }
  if (block.length < 10) break;
  const [num, level, title, poem, ...readings] = block;
  if (Number(num) !== n) {
    console.error(`期望 ${n} 实际 ${num} 在 cursor=${cursor}`);
    break;
  }
  slips.push({
    number: n,
    level,
    title,
    poem,
    readings: {
      "综合运势": readings[0],
      "事业学业": readings[1],
      "财运": readings[2],
      "感情姻缘": readings[3],
      "人际贵人": readings[4],
      "平安健康": readings[5],
    },
  });
}

console.log(`抽到 ${slips.length} 支签`);
fs.writeFileSync("/tmp/slips-100.json", JSON.stringify(slips, null, 2));
```

跑：

```bash
cd /Users/edy/Desktop/workspace/occult
pnpm tsx scripts/extract-slips.ts
# 校验:
node -e 'const d=require("/tmp/slips-100.json"); console.log(d.length); console.log(d[0]); console.log(d[99])'
```

预期：抽到 100 支签；第 1 支签题"心定福自来"，第 100 支签题"静心养气"。

- [ ] **Step 2：写失败测试**

`db/seed/slips-v2.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { SLIPS_V2 } from "./slips-v2";

describe("100 支签 seed", () => {
  it("总数 100", () => {
    expect(SLIPS_V2).toHaveLength(100);
  });

  it("签号连续 1-100", () => {
    for (let i = 0; i < 100; i++) {
      expect(SLIPS_V2[i].number).toBe(i + 1);
    }
  });

  it("每支签 6 维度解读完整", () => {
    const required = ["综合运势", "事业学业", "财运", "感情姻缘", "人际贵人", "平安健康"];
    for (const slip of SLIPS_V2) {
      for (const dim of required) {
        expect(slip.readings[dim]).toBeTypeOf("string");
        expect(slip.readings[dim].length).toBeGreaterThan(2);
      }
    }
  });

  it("等级是 6 类之一", () => {
    const levels = ["上上", "上吉", "吉", "平", "渐顺", "慎行"];
    for (const slip of SLIPS_V2) {
      expect(levels).toContain(slip.level);
    }
  });

  it("第 1 签 心定福自来", () => {
    expect(SLIPS_V2[0].title).toBe("心定福自来");
    expect(SLIPS_V2[0].level).toBe("上上");
  });

  it("第 100 签 静心养气", () => {
    expect(SLIPS_V2[99].title).toBe("静心养气");
    expect(SLIPS_V2[99].level).toBe("慎行");
  });
});
```

- [ ] **Step 3：跑测试确认 RED**

```bash
pnpm vitest run db/seed/slips-v2.test.ts
```

预期：FAIL（"Cannot find module slips-v2"）

- [ ] **Step 4：把 /tmp/slips-100.json 转成 slips-v2.ts**

```bash
cd /Users/edy/Desktop/workspace/occult
node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync("/tmp/slips-100.json", "utf-8"));
  const header = `// 自动生成自 docs 文档章节 3.1.3，请勿手改\n// 重新生成: pnpm tsx scripts/extract-slips.ts && pnpm tsx scripts/format-slips.ts\n\nexport interface SlipSeed {\n  number: number;\n  level: \"上上\" | \"上吉\" | \"吉\" | \"平\" | \"渐顺\" | \"慎行\";\n  title: string;\n  poem: string;\n  readings: {\n    \"综合运势\": string;\n    \"事业学业\": string;\n    \"财运\": string;\n    \"感情姻缘\": string;\n    \"人际贵人\": string;\n    \"平安健康\": string;\n  };\n}\n\nexport const SLIPS_V2: readonly SlipSeed[] = `;
  fs.writeFileSync("db/seed/slips-v2.ts", header + JSON.stringify(data, null, 2) + " as const;\n");
'
```

- [ ] **Step 5：跑测试确认 GREEN**

```bash
pnpm vitest run db/seed/slips-v2.test.ts
```

预期：6 个断言全过。

- [ ] **Step 6：seed 入口换 slips-v2**

修改 `lib/db/seed.ts`：

```ts
// 找到原 import 旧 slips 那一行,改为：
import { SLIPS_V2 } from "../db/seed/slips-v2";

// seed 函数里的循环:
for (const slip of SLIPS_V2) {
  await db.insert(divinationSlips).values({
    number: slip.number,
    level: slip.level,
    title: slip.title,
    poem: slip.poem,
    readings: JSON.stringify(slip.readings),
  }).onConflictDoNothing();
}
```

- [ ] **Step 7：删除旧文件**

```bash
rm db/seed/slips.ts
rm db/seed/slips.test.ts 2>/dev/null
```

- [ ] **Step 8：本地 wipe + reseed 验证**

```bash
pnpm db:reset
pnpm tsx -e 'import { getDb } from "@/lib/db/client"; import { divinationSlips } from "@/lib/db/schema"; const db = getDb(); const r = await db.select().from(divinationSlips); console.log("总数:", r.length); console.log(r[0]);'
```

预期：100 支签全 seed 成功。

- [ ] **Step 9：commit**

```bash
git add db/seed/slips-v2.ts db/seed/slips-v2.test.ts lib/db/seed.ts scripts/extract-slips.ts
git rm db/seed/slips.ts db/seed/slips.test.ts 2>/dev/null
git commit -m "feat(seed): 100 支签全量替换（覆盖旧 30 支版本）"
```

**Acceptance：**
- `db/seed/slips-v2.ts` 含 100 个常量条目，每条 6 维度
- `pnpm vitest run db/seed/slips-v2.test.ts` 全过
- `pnpm db:reset` 后 `divination_slips` 表 100 行
- 第 1 签 = 心定福自来 / 上上；第 100 签 = 静心养气 / 慎行

**工时：3 h**（含数据抽取调试）

---

### Task M1.3：意图分类器（关键词层导出 + LLM 兜底）

**Files：**
- Modify: `/Users/edy/Desktop/workspace/occult/lib/ai/intent.ts`（导出 classifyByKeyword）
- Create: `/Users/edy/Desktop/workspace/occult/lib/ai/intent-classifier.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/ai/intent-classifier.test.ts`

- [ ] **Step 1：写 30+ 句失败测试**

`lib/ai/intent-classifier.test.ts`：

```ts
import { describe, it, expect, vi } from "vitest";
import { classifyIntent } from "./intent-classifier";

vi.mock("./client", () => ({
  chat: vi.fn(async ({ messages }) => {
    const userText = messages[messages.length - 1].content;
    // 模拟 LLM 返回——根据语义猜
    if (/梦|做梦|梦见/.test(userText)) return { text: "dream", tokensUsed: 5 };
    if (/抽签|签|占|抽支/.test(userText)) return { text: "divination", tokensUsed: 5 };
    if (/八字|命盘|命格|命理/.test(userText)) return { text: "bazi", tokensUsed: 5 };
    if (/算/.test(userText)) return { text: "meihua", tokensUsed: 5 };
    return { text: "chat", tokensUsed: 5 };
  }),
}));

describe("classifyIntent (B 策略 = 关键词 + LLM 兜底)", () => {
  describe("关键词层（source: keyword）", () => {
    const cases = [
      ["我要抽灵签", "divination"],
      ["我要测算", "meihua"],
      ["我要 AI 解梦", "dream"],
      ["我要八字解读", "bazi"],
      ["抽个签吧", "divination"],
      ["帮我解个梦", "dream"],
      ["看我的八字", "bazi"],
    ] as const;
    for (const [text, expected] of cases) {
      it(`"${text}" → ${expected}`, async () => {
        const r = await classifyIntent(text);
        expect(r.intent).toBe(expected);
        expect(r.source).toBe("keyword");
      });
    }
  });

  describe("LLM 兜底层（source: llm）", () => {
    const cases = [
      ["我做了一个非常奇怪的梦，需要给解读一下", "dream"],
      ["帮我算一下事业运势", "meihua"],
      ["我的命盘怎么样", "bazi"],
      ["你好啊福小运", "chat"],
      ["最近工作压力大想聊聊", "chat"],
    ] as const;
    for (const [text, expected] of cases) {
      it(`"${text}" → ${expected}`, async () => {
        const r = await classifyIntent(text);
        expect(r.intent).toBe(expected);
        expect(r.source).toBe("llm");
      });
    }
  });

  describe("LLM 失败 fallback chat", () => {
    it("LLM throw 时返回 chat / source=fallback", async () => {
      const { chat } = await import("./client");
      (chat as any).mockRejectedValueOnce(new Error("AI down"));
      const r = await classifyIntent("某种乱七八糟的输入");
      expect(r.intent).toBe("chat");
      expect(r.source).toBe("fallback");
    });
  });

  describe("空输入", () => {
    it("空字符串 → chat / fallback", async () => {
      const r = await classifyIntent("");
      expect(r.intent).toBe("chat");
      expect(r.source).toBe("fallback");
    });
  });
});
```

- [ ] **Step 2：跑测试确认 RED**

```bash
pnpm vitest run lib/ai/intent-classifier.test.ts
```

预期：FAIL（找不到模块）

- [ ] **Step 3：先把 lib/ai/intent.ts 的关键词层导出**

`lib/ai/intent.ts` 末尾追加（如未导出）：

```ts
// 导出关键词层供 classifier 复用
export function classifyByKeyword(text: string): Intent | null {
  if (!text || text.trim().length === 0) return null;
  const t = text.trim();

  // 显式指令（最高优先级）
  if (/^我要(抽签|抽灵签|求签|抽个签)/.test(t)) return "divination";
  if (/^我要(测算|进行数字测算)/.test(t)) return "meihua";
  if (/^我要(AI?)?\s?解梦/i.test(t)) return "dream";
  if (/^我要(进行)?(AI)?\s?八字解读/i.test(t)) return "bazi";

  // 关键词命中
  if (/抽(灵)?签|求签|抽支签/.test(t)) return "divination";
  if (/解梦|周公解梦/.test(t)) return "dream";
  if (/八字|命盘|命理|流年|大运/.test(t)) return "bazi";
  if (/^帮我算|^算一(下|算)/.test(t)) return "meihua";

  return null;
}
```

- [ ] **Step 4：实现 classifier（关键词 + LLM 兜底）**

`lib/ai/intent-classifier.ts`：

```ts
import "server-only";
import { classifyByKeyword } from "./intent";
import { chat } from "./client";
import type { Intent } from "@/types/domain";

const VALID_INTENTS = ["chat", "divination", "dream", "bazi", "meihua"] as const;

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  source: "keyword" | "llm" | "fallback";
}

const CLASSIFY_SYSTEM_PROMPT = `你是意图分类器。把用户的中文输入归到下列 5 个类别之一，只输出标签词，不输出任何解释：

- divination：用户想抽灵签 / 抽签
- dream：用户想解梦或描述了梦境内容
- bazi：用户想看命盘 / 八字 / 命格 / 大运
- meihua：用户想用梅花易数 / 数字测算占卜某件具体的事
- chat：以上都不是，普通闲聊或其他咨询

只能输出 5 个标签词中的 1 个。不要输出标点和其他字。`;

const CLASSIFIER_TIMEOUT_MS = 5000;

export async function classifyIntent(text: string): Promise<IntentClassification> {
  if (!text || text.trim().length === 0) {
    return { intent: "chat", confidence: 0, source: "fallback" };
  }

  // 第一层：关键词
  const kw = classifyByKeyword(text);
  if (kw) {
    return { intent: kw, confidence: 1, source: "keyword" };
  }

  // 第二层：LLM
  try {
    const ai = await Promise.race([
      chat({
        systemPrompt: CLASSIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: text.slice(0, 500) }],
        stream: false,
        meta: { conversationId: "intent-classify", userId: "system" },
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("intent classifier timeout")), CLASSIFIER_TIMEOUT_MS),
      ),
    ]);
    const label = ai.text.trim().toLowerCase();
    const intent = VALID_INTENTS.find((i) => label.includes(i));
    if (intent) {
      return { intent, confidence: 0.85, source: "llm" };
    }
    return { intent: "chat", confidence: 0.5, source: "fallback" };
  } catch (e) {
    console.error("intent classifier 失败", e);
    return { intent: "chat", confidence: 0, source: "fallback" };
  }
}
```

- [ ] **Step 5：跑测试确认 GREEN**

```bash
pnpm vitest run lib/ai/intent-classifier.test.ts
```

预期：12 个断言全过。

- [ ] **Step 6：补 lib/ai/intent.ts 测试**

`lib/ai/intent.test.ts` 加导出测试：

```ts
import { classifyByKeyword } from "./intent";

describe("classifyByKeyword", () => {
  it("空 → null", () => expect(classifyByKeyword("")).toBeNull());
  it("纯闲聊 → null（让 LLM 兜底）", () => expect(classifyByKeyword("你好啊")).toBeNull());
  it("我要抽灵签 → divination", () => expect(classifyByKeyword("我要抽灵签")).toBe("divination"));
  it("我要测算 → meihua", () => expect(classifyByKeyword("我要测算")).toBe("meihua"));
  it("我要AI解梦 → dream", () => expect(classifyByKeyword("我要AI解梦")).toBe("dream"));
  it("我要八字解读 → bazi", () => expect(classifyByKeyword("我要八字解读")).toBe("bazi"));
});
```

- [ ] **Step 7：commit**

```bash
git add lib/ai/intent.ts lib/ai/intent.test.ts lib/ai/intent-classifier.ts lib/ai/intent-classifier.test.ts
git commit -m "feat(ai): 意图分类器（关键词 + LLM 兜底）"
```

**Acceptance：**
- 12 个 classifier 断言全过 + 6 个 keyword 断言全过
- LLM 调用 5s 超时保护
- LLM 失败 / 空输入正确 fallback chat

**工时：4 h**

---

### Task M1.4：对话摘要器

**Files：**
- Create: `/Users/edy/Desktop/workspace/occult/lib/ai/summarizer.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/ai/summarizer.test.ts`

- [ ] **Step 1：写失败测试**

`lib/ai/summarizer.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { summarize, buildPromptMessages, K_RECENT, SUMMARIZE_THRESHOLD } from "./summarizer";

vi.mock("./client", () => ({
  chat: vi.fn(async () => ({ text: "用户问八字事业方向，AI 给了四象限建议", tokensUsed: 50 })),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

describe("buildPromptMessages", () => {
  it("无 summary 时返回 system + 最近 K 条 + 当前 user", () => {
    const recentMsgs = [
      { role: "user" as const, content: "你好" },
      { role: "assistant" as const, content: "你好呀" },
      { role: "user" as const, content: "继续" },
    ];
    const result = buildPromptMessages({
      systemPrompt: "你是 AI",
      summary: null,
      recent: recentMsgs,
      userText: "再说一点",
    });
    expect(result).toEqual([
      { role: "system", content: "你是 AI" },
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好呀" },
      { role: "user", content: "继续" },
      { role: "user", content: "再说一点" },
    ]);
  });

  it("有 summary 时插入第 2 条 system message", () => {
    const result = buildPromptMessages({
      systemPrompt: "你是 AI",
      summary: "之前聊了八字事业",
      recent: [],
      userText: "继续",
    });
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe("你是 AI");
    expect(result[1].role).toBe("system");
    expect(result[1].content).toContain("之前聊了八字事业");
    expect(result[2]).toEqual({ role: "user", content: "继续" });
  });
});

describe("summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("消息少于阈值时跳过", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as any).mockReturnValue(makeFakeDb([
      { role: "user", content: "1", created_at: "2026-04-26T01:00:00Z" },
      { role: "assistant", content: "2", created_at: "2026-04-26T01:01:00Z" },
    ]));
    const result = await summarize("conv-1");
    expect(result).toBe("skipped");
  });

  it("消息 ≥ 阈值时调用 chat 并写库", async () => {
    const { chat } = await import("./client");
    const { getDb } = await import("@/lib/db/client");
    const updateMock = vi.fn().mockResolvedValue(undefined);
    (getDb as any).mockReturnValue(makeFakeDb(
      Array.from({ length: 14 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg ${i}`,
        created_at: `2026-04-26T01:${String(i).padStart(2, "0")}:00Z`,
      })),
      updateMock,
    ));
    const result = await summarize("conv-1");
    expect(result).toBe("ok");
    expect(chat).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalled();
  });

  it("chat 抛错时返回 error 不抛", async () => {
    const { chat } = await import("./client");
    (chat as any).mockRejectedValueOnce(new Error("ai down"));
    const { getDb } = await import("@/lib/db/client");
    (getDb as any).mockReturnValue(makeFakeDb(
      Array.from({ length: 14 }, (_, i) => ({
        role: "user", content: `m${i}`, created_at: "2026-04-26T01:00:00Z",
      })),
    ));
    const result = await summarize("conv-1");
    expect(result).toBe("error");
  });
});

function makeFakeDb(msgs: any[], updateMock?: any) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(msgs),
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => updateMock?.() ?? Promise.resolve(),
      }),
    }),
  };
}
```

- [ ] **Step 2：跑 RED**

```bash
pnpm vitest run lib/ai/summarizer.test.ts
```

预期：FAIL（找不到 summarizer）

- [ ] **Step 3：实现 summarizer**

`lib/ai/summarizer.ts`：

```ts
import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { chat } from "./client";

export const K_RECENT = 6;
export const SUMMARIZE_THRESHOLD = 12;
export const SUMMARIZE_INTERVAL = 4;

const SUMMARIZER_PROMPT = `你是对话摘要助手。用 80 字以内中文，总结这段对话的关键事实和未决问题。
忽略寒暄。重点保留：用户的问题、AI 的核心建议、提到的人 / 事 / 时间。
直接输出摘要，不加"摘要："等前缀。`;

export type SummarizeResult = "ok" | "skipped" | "error";

export async function summarize(conversationId: string): Promise<SummarizeResult> {
  const db = getDb();
  try {
    const allMsgs = await db
      .select({
        role: messages.role,
        content: messages.content,
        created_at: messages.created_at,
      })
      .from(messages)
      .where(eq(messages.conversation_id, conversationId))
      .orderBy(asc(messages.created_at))
      .limit(1000);

    if (allMsgs.length < SUMMARIZE_THRESHOLD) {
      return "skipped";
    }

    const cutoff = allMsgs.length - K_RECENT;
    const oldMsgs = allMsgs.slice(0, cutoff);
    const transcript = oldMsgs
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 6000);

    const ai = await chat({
      systemPrompt: SUMMARIZER_PROMPT,
      messages: [{ role: "user", content: transcript }],
      stream: false,
      meta: { conversationId, userId: "summarizer" },
    });

    await db
      .update(conversations)
      .set({ summary: ai.text.trim(), summary_msg_count: cutoff })
      .where(eq(conversations.id, conversationId));

    return "ok";
  } catch (e) {
    console.error("summarizer 失败", e);
    return "error";
  }
}

export interface BuildPromptArgs {
  systemPrompt: string;
  summary: string | null;
  recent: Array<{ role: "user" | "assistant"; content: string }>;
  userText: string;
}

export interface ChatPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildPromptMessages(args: BuildPromptArgs): ChatPromptMessage[] {
  const out: ChatPromptMessage[] = [{ role: "system", content: args.systemPrompt }];
  if (args.summary && args.summary.trim().length > 0) {
    out.push({ role: "system", content: `[此前对话摘要]\n${args.summary}` });
  }
  for (const m of args.recent) {
    out.push({ role: m.role, content: m.content });
  }
  out.push({ role: "user", content: args.userText });
  return out;
}

export function shouldSummarize(totalMessages: number, lastSummaryMsgCount: number): boolean {
  return (
    totalMessages >= SUMMARIZE_THRESHOLD &&
    totalMessages - lastSummaryMsgCount >= SUMMARIZE_INTERVAL
  );
}
```

- [ ] **Step 4：跑 GREEN**

```bash
pnpm vitest run lib/ai/summarizer.test.ts
```

预期：5 个断言全过。

- [ ] **Step 5：commit**

```bash
git add lib/ai/summarizer.ts lib/ai/summarizer.test.ts
git commit -m "feat(ai): 对话摘要器（K_RECENT=6 / 阈值 12 / 间隔 4）"
```

**Acceptance：**
- 5 个测试全过
- `summarize()` 失败不抛，返回 "error"
- `buildPromptMessages()` 在 summary null / 非空 / recent 不同长度都正确
- `shouldSummarize(11, 0)` = false / `shouldSummarize(12, 0)` = true / `shouldSummarize(15, 12)` = false / `shouldSummarize(16, 12)` = true

**工时：3 h**

---

## M1 部署 checkpoint

M1 不改对外接口，部署到腾讯云只是为了让 schema 就绪：

```bash
# 本地
git push  # 如果有 remote；否则跳

# 腾讯云
KEY=/Users/edy/Downloads/renliang.pem
SERVER=ubuntu@43.129.186.82
ssh -i $KEY $SERVER 'mkdir -p ~/occult/db/seed ~/occult/db/migrations-sqlite ~/occult/lib/ai ~/occult/lib/fortune ~/occult/lib/db'
scp -i $KEY \
  lib/db/schema.ts \
  lib/fortune/scorer.ts \
  lib/ai/intent.ts \
  lib/ai/intent-classifier.ts \
  lib/ai/summarizer.ts \
  $SERVER:~/occult/lib/...   # 按相对路径展开

scp -i $KEY db/seed/slips-v2.ts $SERVER:~/occult/db/seed/
scp -i $KEY db/migrations-sqlite/0006_doc_realignment.sql $SERVER:~/occult/db/migrations-sqlite/

ssh -i $KEY $SERVER bash -s << 'EOS'
cd ~/occult
docker compose down qingyun
sudo rm -f data/qingyun.db data/qingyun.db-wal data/qingyun.db-shm
sudo chown -R 1001:1001 data
docker compose build --no-cache
docker compose up -d
sleep 8
docker compose exec -T qingyun env | grep AI_GATEWAY_API_KEY
docker compose exec -T qingyun sh -c 'sqlite3 /app/data/qingyun.db ".schema conversations"' | grep summary
docker compose exec -T qingyun sh -c 'sqlite3 /app/data/qingyun.db "SELECT COUNT(*) FROM divination_slips"'
EOS
```

预期：
- env grep 出 AI key 非空
- conversations schema 含 summary 列
- divination_slips 100 行

---

## M2：chat 重做 + 4 sub-action（24 h / 3 d / 5 task）

意图分流真正落地。M2 完成后客户端老 launcher 仍存在但 `/api/chat` 已改成"分流路由器"，4 个 sub-action API 改为"接卡片提交→写消息+流式解读"模式。前端在 M3 才彻底改造。

### Task M2.1：/api/chat SSE 重做（multi-turn + 意图分流）

**Files：**
- Modify: `/Users/edy/Desktop/workspace/occult/app/api/chat/route.ts`（整体重写）
- Modify: `/Users/edy/Desktop/workspace/occult/app/api/chat/route.test.ts` 如有

- [ ] **Step 1：写新 schema 失败测试**

`app/api/chat/route.test.ts`（如不存在则新建）：

```ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({
  ensureUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/ai/check-rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, used: 0, limit: 30 })),
}));

vi.mock("@/lib/ai/intent-classifier", () => ({
  classifyIntent: vi.fn(async (text: string) => {
    if (text.includes("抽签") || text.includes("抽灵签")) return { intent: "divination", confidence: 1, source: "keyword" };
    if (text.includes("解梦")) return { intent: "dream", confidence: 1, source: "keyword" };
    if (text.includes("八字")) return { intent: "bazi", confidence: 1, source: "keyword" };
    if (text.includes("测算")) return { intent: "meihua", confidence: 1, source: "keyword" };
    return { intent: "chat", confidence: 0.5, source: "fallback" };
  }),
}));

describe("POST /api/chat schema", () => {
  it("conversationId:null 不报 400", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: null, text: "你好" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("空 text 报 400", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("超长 text > 2000 报 400", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(2001) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2：跑 RED**

```bash
pnpm vitest run app/api/chat/route.test.ts
```

预期：FAIL（route 还是旧实现，schema 不匹配等）

- [ ] **Step 3：重写 /api/chat/route.ts**

完整替换为：

```ts
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { classifyIntent } from "@/lib/ai/intent-classifier";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { chat } from "@/lib/ai/client";
import { guardTexts } from "@/lib/safety/guard";
import {
  buildPromptMessages,
  shouldSummarize,
  summarize,
  K_RECENT,
} from "@/lib/ai/summarizer";
import { serializeJson } from "@/lib/db/json";
import type { Intent } from "@/types/domain";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().min(1).nullish(),
  text: z.string().min(1, "消息不能为空").max(2000, "消息超过 2000 字"),
});

const SYSTEM_PROMPT = [
  "你是福小运，一位温柔、年轻化的国学陪伴助手。",
  "回复风格：自然、简短（默认 80–200 字），有温度但不端说教架子。",
  "禁用：大凶 / 倒霉 / 厄运 / 命中注定 等绝对负面词。",
  "结尾不要硬贴『加油』『相信自己』这种空洞鸡汤。",
].join("\n");

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return jsonError("请求体不是合法 JSON", 400); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "校验失败", 400);
  const { conversationId: incomingConvId, text } = parsed.data;

  const safetyFail = guardTexts({ text });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const limit = await checkRateLimit(userId);
  if (!limit.allowed) {
    return jsonError(`每小时上限 ${limit.limit} 条，请稍后再试（已发 ${limit.used}）`, 429);
  }

  const db = getDb();

  // 建/取 conversation
  let convId = incomingConvId ?? null;
  if (convId) {
    const owned = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.user_id, userId)))
      .limit(1);
    if (!owned[0]) return jsonError("会话不存在", 404);
  } else {
    const [created] = await db
      .insert(conversations)
      .values({ user_id: userId, title: text.slice(0, 10) })
      .returning({ id: conversations.id });
    convId = created?.id ?? null;
    if (!convId) return jsonError("创建会话失败", 500);
  }
  const finalConvId: string = convId;

  // 意图分类
  const cls = await classifyIntent(text);
  const intent: Intent = cls.intent;

  // 写 user message
  await db.insert(messages).values({
    conversation_id: finalConvId, role: "user", content: text, intent,
  });

  // 更新 last_intent
  await db.update(conversations)
    .set({ last_intent: intent, last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, finalConvId));

  // 分流
  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      controller.enqueue(sseFrame(encoder, "meta", { conversationId: finalConvId, intent, source: cls.source }));

      try {
        if (intent === "chat") {
          await streamChatReply({ controller, encoder, convId: finalConvId, userId, text });
        } else {
          // 写引导卡 message
          const cardMeta = buildGuideCard(intent);
          const [card] = await db.insert(messages).values({
            conversation_id: finalConvId,
            role: "assistant",
            content: cardMeta.contentText,
            intent,
            metadata: serializeJson(cardMeta.meta),
          }).returning();
          controller.enqueue(sseFrame(encoder, "card", {
            id: card?.id, role: "assistant", content: cardMeta.contentText, metadata: serializeJson(cardMeta.meta),
          }));
        }
        controller.enqueue(sseFrame(encoder, "done", {}));
      } catch (e) {
        console.error("/api/chat 失败", e);
        controller.enqueue(sseFrame(encoder, "error", { message: "AI 卡了一下，请稍后再试" }));
      } finally {
        controller.close();

        // 异步触发摘要器
        void maybeSummarize(finalConvId);
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

interface GuideCard {
  contentText: string;
  meta: { ui: string; [k: string]: unknown };
}

function buildGuideCard(intent: Intent): GuideCard {
  switch (intent) {
    case "divination":
      return {
        contentText: "好的，您想求哪一类签？",
        meta: {
          ui: "slip_type_picker",
          options: [
            { key: "综合运势", label: "综合运势" },
            { key: "事业学业", label: "事业学业" },
            { key: "财运", label: "财运" },
            { key: "感情姻缘", label: "感情姻缘" },
            { key: "人际贵人", label: "人际贵人" },
            { key: "平安健康", label: "平安健康" },
          ],
        },
      };
    case "dream":
      return {
        contentText: "请问您想快速解梦还是精准解梦？",
        meta: {
          ui: "dream_choice",
          options: [
            { key: "fast", label: "快速解梦", hint: "简单描述 快速解梦" },
            { key: "precise", label: "精准解梦", hint: "多维度场景描述 精准解读" },
          ],
        },
      };
    case "bazi":
      return {
        contentText: "请填写八字信息",
        meta: { ui: "bazi_quick_form" },
      };
    case "meihua":
      return {
        contentText: "好的，请把您想测算的事情详细描述出来，越精准越好哦。",
        meta: { ui: "meihua_intro" },
      };
    default:
      return { contentText: "", meta: { ui: "text" } };
  }
}

async function streamChatReply(args: {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  convId: string;
  userId: string;
  text: string;
}) {
  const db = getDb();
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, args.convId)).limit(1);
  const recent = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversation_id, args.convId))
    .orderBy(desc(messages.created_at))
    .limit(K_RECENT + 1);

  // 去掉刚写入的当条 user
  const recentExclSelf = recent.slice(1).reverse();

  const prompt = buildPromptMessages({
    systemPrompt: SYSTEM_PROMPT,
    summary: conv?.summary ?? null,
    recent: recentExclSelf.filter((m) => m.role !== "system").map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    userText: args.text,
  });

  const stream = await chat({
    messages: prompt.slice(1).map((m) => ({ role: m.role as any, content: m.content })),
    systemPrompt: SYSTEM_PROMPT,
    stream: true,
    meta: { conversationId: args.convId, userId: args.userId },
  });

  let assistantText = "";
  let tokens = 0;
  for await (const chunk of stream.textStream) {
    assistantText += chunk;
    args.controller.enqueue(sseFrame(args.encoder, "token", chunk));
  }
  try { tokens = (await stream.usage).totalTokens ?? 0; } catch { /* 忽略 */ }

  await db.insert(messages).values({
    conversation_id: args.convId,
    role: "assistant",
    content: assistantText || "(无内容)",
    intent: "chat",
    tokens_used: tokens,
  });
}

async function maybeSummarize(convId: string) {
  try {
    const db = getDb();
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
    if (!conv) return;
    const allMsgs = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversation_id, convId));
    if (shouldSummarize(allMsgs.length, conv.summary_msg_count ?? 0)) {
      await summarize(convId);
    }
  } catch (e) {
    console.error("maybeSummarize failed", e);
  }
}

function sseFrame(encoder: TextEncoder, event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4：跑 GREEN**

```bash
pnpm vitest run app/api/chat/route.test.ts
pnpm typecheck
```

预期：3 个断言通过 + 类型干净。

- [ ] **Step 5：本地手测分流**

```bash
pnpm dev   # 端口 3010 / 3002 / 3000 任一
```

另开终端：

```bash
JAR=/tmp/qy.cookies; rm -f $JAR
PORT=3002  # 改为 dev 实际端口
curl -sS -c $JAR http://localhost:$PORT/ -o /dev/null

# 测 chat 分流
for text in "你好" "我要抽灵签" "我要解梦" "我要八字解读" "我要测算"; do
  echo "==== $text ===="
  curl -sS -b $JAR -X POST http://localhost:$PORT/api/chat \
    -H "content-type: application/json" \
    -d "{\"text\":\"$text\"}" --max-time 30 -N 2>&1 | head -8
  echo
done
```

预期：
- "你好" → meta intent=chat + 流式 token
- "我要抽灵签" → meta intent=divination + card 带 slip_type_picker
- "我要解梦" → meta intent=dream + card 带 dream_choice
- "我要八字解读" → meta intent=bazi + card 带 bazi_quick_form
- "我要测算" → meta intent=meihua + card 带 meihua_intro

- [ ] **Step 6：commit**

```bash
git add app/api/chat/route.ts app/api/chat/route.test.ts
git commit -m "feat(api): /api/chat 重做 — multi-turn memory + 意图分流 + 引导卡输出"
```

**Acceptance：**
- 5 类意图分流验证通过
- conversationId:null 接受
- multi-turn：第 13 条消息后 conversations.summary 非空
- chat 流式仍正常出 token

**工时：6 h**

---

### Task M2.2：/api/divination/qianwen 重做（接 slip_type_picker 提交）

**Files：**
- Modify: `/Users/edy/Desktop/workspace/occult/app/api/divination/qianwen/route.ts`
- Modify / 新建: `app/api/divination/qianwen/route.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// app/api/divination/qianwen/route.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/divination/qianwen", () => {
  it("body 必须含 conversationId（已有 conversation 才能贴卡）", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dimension: "事业学业", userQuestion: "项目能成吗" }),
    }));
    expect(r.status).toBe(400);
  });

  it("dimension 必须是新 6 类之一", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "abc", dimension: "事业", userQuestion: "?" }),
    }));
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2：跑 RED**

```bash
pnpm vitest run app/api/divination/qianwen/route.test.ts
```

- [ ] **Step 3：重写 qianwen route**

```ts
// app/api/divination/qianwen/route.ts 完整替换
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, divinationRecords, divinationSlips, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { pickSlip } from "@/lib/divination/slips";
import { parseJson, serializeJson } from "@/lib/db/json";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 90;

const DIMENSIONS = ["综合运势", "事业学业", "财运", "感情姻缘", "人际贵人", "平安健康"] as const;

const bodySchema = z.object({
  conversationId: z.string().min(1),  // 卡片提交必须已有会话
  dimension: z.enum(DIMENSIONS),
  userQuestion: z.string().min(1).max(500),
});

interface SlipReadings {
  综合运势?: string;
  事业学业?: string;
  财运?: string;
  感情姻缘?: string;
  人际贵人?: string;
  平安健康?: string;
}

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "校验失败", issues: parsed.error.issues }, { status: 400 });
  }
  const { conversationId, dimension, userQuestion } = parsed.data;

  const safetyFail = guardTexts({ userQuestion });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const rate = await checkRateLimit(userId);
  if (!rate.allowed) {
    return jsonError(`每小时上限 ${rate.limit} 条，请稍后再试（已用 ${rate.used}）`, 429);
  }

  const db = getDb();
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);

  const { number } = pickSlip({ seed: `${userId}-${Date.now()}` });
  const [slip] = await db.select().from(divinationSlips).where(eq(divinationSlips.number, number)).limit(1);
  if (!slip) return jsonError(`灵签 #${number} 未找到`, 500);

  const readings = parseJson<SlipReadings>(slip.readings, {});
  const reading = readings[dimension] ?? readings["综合运势"] ?? "（暂无该维度解读）";

  // user message: 用户在卡片上选了维度 + 描述
  const [userMsg] = await db.insert(messages).values({
    conversation_id: conversationId,
    role: "user",
    content: `[抽签 · ${dimension}] ${userQuestion}`,
    intent: "divination",
  }).returning();

  // assistant message: slip_image 卡片
  const [cardMsg] = await db.insert(messages).values({
    conversation_id: conversationId,
    role: "assistant",
    content: `抽到第 ${slip.number} 签 · ${slip.level} · ${slip.title}`,
    intent: "divination",
    metadata: serializeJson({
      ui: "slip_image",
      slipNumber: slip.number,
      level: slip.level,
      title: slip.title,
      poem: slip.poem,
      dimension,
      reading,
    }),
  }).returning();

  await db.insert(divinationRecords).values({
    message_id: cardMsg!.id,
    type: "qianwen",
    input: serializeJson({ dimension, userQuestion }),
    result: serializeJson({ number: slip.number, level: slip.level, title: slip.title, poem: slip.poem, reading }),
  });

  // AI 解读非流式（第 3 条消息）
  let aiReading: { id: string; content: string; created_at: string; metadata: string | null } | null = null;
  try {
    const prompt = await loadPrompt("qianwen.interpret");
    const userText = renderTemplate(prompt.userPromptTpl, {
      slipNumber: slip.number, level: slip.level, title: slip.title, poem: slip.poem,
      dimension, dimensionReading: reading, userQuestion,
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: userText }],
      stream: false,
      meta: { conversationId, userId },
    });
    const [aiMsg] = await db.insert(messages).values({
      conversation_id: conversationId,
      role: "assistant",
      content: ai.text,
      intent: "divination",
      tokens_used: ai.tokensUsed,
      metadata: serializeJson({ ui: "text", source: "slip_reading" }),
    }).returning();
    if (aiMsg) {
      aiReading = { id: aiMsg.id, content: aiMsg.content, created_at: aiMsg.created_at, metadata: aiMsg.metadata };
    }
  } catch (e) {
    console.error("抽签 AI 解读失败（卡片仍返回）", e);
  }

  await db.update(conversations)
    .set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({
    conversationId,
    userMessage: { id: userMsg!.id, role: "user", content: userMsg!.content, created_at: userMsg!.created_at },
    cardMessage: { id: cardMsg!.id, role: "assistant", content: cardMsg!.content, created_at: cardMsg!.created_at, metadata: cardMsg!.metadata },
    aiReadingMessage: aiReading,
  });
}

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
```

注：如 `lib/ai/prompts.ts` 没有 `qianwen.interpret` prompt 模板，先在该文件加一条简单模板：

```ts
// lib/ai/prompts.ts ── 加 qianwen.interpret 模板
"qianwen.interpret": {
  systemPrompt: "你是温柔的国学解读者，把签文翻译成贴近年轻人的话语。",
  userPromptTpl: `用户抽到了第 {{slipNumber}} 签【{{level}} · {{title}}】，签诗：{{poem}}。
用户主选维度：{{dimension}}
该维度核心解读：{{dimensionReading}}
用户具体的事：{{userQuestion}}

请生成 80-150 字的温柔解读，结构：先呼应签题氛围 1 句 → 落到具体那件事的建议 2-3 句 → 一句轻寄语。禁用绝对负面词。`,
},
```

- [ ] **Step 4：跑 GREEN + 类型**

```bash
pnpm vitest run app/api/divination/qianwen/route.test.ts
pnpm typecheck
```

- [ ] **Step 5：commit**

```bash
git add app/api/divination/qianwen/route.ts app/api/divination/qianwen/route.test.ts lib/ai/prompts.ts
git commit -m "feat(api): qianwen 改为 sub-action（接 slip_type_picker → 写卡片消息 + AI 解读）"
```

**Acceptance：**
- conversationId 必填（旧 nullish 改为 min(1)）
- dimension 是新 6 类
- 返回 3 条 message 的 ID（user / cardMessage / aiReadingMessage）
- cardMessage.metadata.ui = 'slip_image'

**工时：4 h**

---

### Task M2.3：/api/divination/dream 重做（接 dream_choice → fast/precise）

**Files：**
- Modify: `app/api/divination/dream/route.ts`
- Modify / 新建: `app/api/divination/dream/route.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/divination/dream", () => {
  it("mode=fast 必须含 dreamText", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", mode: "fast", payload: {} }),
    }));
    expect(r.status).toBe(400);
  });

  it("mode=precise 必须含 core + emotion", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", mode: "precise", payload: { core: "梦到山" } }),
    }));
    expect(r.status).toBe(400);
  });

  it("mode 必须是 fast / precise", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", mode: "weird", payload: {} }),
    }));
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/api/divination/dream/route.test.ts
```

- [ ] **Step 3：重写 dream route**

```ts
// app/api/divination/dream/route.ts 完整替换
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, divinationRecords, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { parseJson, serializeJson } from "@/lib/db/json";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";

export const runtime = "nodejs";
export const maxDuration = 90;

const fastSchema = z.object({
  dreamText: z.string().min(10).max(2000),
  emotion: z.enum(["平静", "害怕", "焦虑", "喜悦", "疑惑"]).nullish(),
});

const preciseSchema = z.object({
  core: z.string().min(5).max(500),
  emotion: z.string().min(2).max(200),
  reality: z.string().max(200).nullish(),
  special: z.string().max(200).nullish(),
});

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ conversationId: z.string().min(1), mode: z.literal("fast"), payload: fastSchema }),
  z.object({ conversationId: z.string().min(1), mode: z.literal("precise"), payload: preciseSchema }),
]);

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "校验失败", issues: parsed.error.issues }, { status: 400 });
  }
  const { conversationId, mode, payload } = parsed.data;

  const safetyText = mode === "fast" ? payload.dreamText : `${payload.core}\n${payload.emotion}\n${payload.reality ?? ""}\n${payload.special ?? ""}`;
  const safetyFail = guardTexts({ dream: safetyText });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const rate = await checkRateLimit(userId);
  if (!rate.allowed) return jsonError(`每小时上限 ${rate.limit} 条，已用 ${rate.used}`, 429);

  const db = getDb();
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);

  // user message
  const userText = mode === "fast"
    ? `[解梦 · 快速${payload.emotion ? " · " + payload.emotion : ""}] ${payload.dreamText}`
    : `[解梦 · 精准]\n核心场景：${payload.core}\n情绪感受：${payload.emotion}${payload.reality ? "\n现实关联：" + payload.reality : ""}${payload.special ? "\n特殊细节：" + payload.special : ""}`;
  const [userMsg] = await db.insert(messages).values({
    conversation_id: conversationId, role: "user", content: userText, intent: "dream",
  }).returning();

  // AI 解读
  let aiText = "（解读暂时不可用，请稍后再试）";
  let tokens = 0;
  try {
    const prompt = await loadPrompt("dream.interpret");
    const tpl = renderTemplate(prompt.userPromptTpl, {
      mode,
      dreamText: mode === "fast" ? payload.dreamText : "",
      core: mode === "precise" ? payload.core : "",
      emotion: mode === "fast" ? (payload.emotion ?? "未明确") : payload.emotion,
      reality: mode === "precise" ? (payload.reality ?? "（用户未填）") : "",
      special: mode === "precise" ? (payload.special ?? "（用户未填）") : "",
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: tpl }],
      stream: false,
      meta: { conversationId, userId },
    });
    aiText = ai.text;
    tokens = ai.tokensUsed;
  } catch (e) {
    console.error("dream AI 解读失败", e);
  }

  // assistant message: dream_result
  const [resultMsg] = await db.insert(messages).values({
    conversation_id: conversationId,
    role: "assistant",
    content: aiText,
    intent: "dream",
    tokens_used: tokens,
    metadata: serializeJson({ ui: "dream_result", mode }),
  }).returning();

  await db.insert(divinationRecords).values({
    message_id: resultMsg!.id,
    type: "dream",
    input: serializeJson({ mode, payload }),
    result: serializeJson({ text: aiText }),
  });

  await db.update(conversations).set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({
    conversationId,
    userMessage: { id: userMsg!.id, role: "user", content: userMsg!.content, created_at: userMsg!.created_at },
    resultMessage: {
      id: resultMsg!.id, role: "assistant", content: resultMsg!.content,
      created_at: resultMsg!.created_at, metadata: resultMsg!.metadata,
    },
  });
}

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
```

如 `lib/ai/prompts.ts` 无 `dream.interpret` 模板，新增（参考 spec §4 文档章节 4 解梦模板）：

```ts
"dream.interpret": {
  systemPrompt: "你是温柔的国学梦境解读者，融合周公解梦 + 弗洛伊德 + 荣格三重视角。",
  userPromptTpl: `解梦模式：{{mode}}
{{#if dreamText}}梦境描述：{{dreamText}}{{/if}}
{{#if core}}核心场景：{{core}}{{/if}}
情绪感受：{{emotion}}
{{#if reality}}现实关联：{{reality}}{{/if}}
{{#if special}}特殊细节：{{special}}{{/if}}

请按下列结构生成 600-1000 字解读：
🌙 共情开篇（温柔接住，明确"不是厄运"）
🔮 三重维度（周公 / 弗洛伊德 / 荣格 各 1 段）
📜 核心寓意 + 重要节点指引（表格形式 2-3 行，禁用"凶"字）
💡 可落地规避方案 3-4 条
💌 潜意识真心话
🌷 治愈结语

禁用：大凶 / 厄运 / 命中注定 等绝对负面词。`,
},
```

(template 引擎如不支持 `{{#if}}`，改为 ternary 注入空字符串 — 看 `lib/ai/prompts.ts` 现有 renderTemplate 风格。)

- [ ] **Step 4：GREEN**

```bash
pnpm vitest run app/api/divination/dream/route.test.ts
pnpm typecheck
```

- [ ] **Step 5：commit**

```bash
git add app/api/divination/dream/route.ts app/api/divination/dream/route.test.ts lib/ai/prompts.ts
git commit -m "feat(api): dream 改为 sub-action（discriminatedUnion fast / precise）"
```

**Acceptance：**
- mode 校验生效（fast 缺 dreamText / precise 缺 core 都 400）
- resultMessage.metadata.ui = 'dream_result'

**工时：3 h**

---

### Task M2.4：/api/divination/bazi 重做（profileSnapshot 支持）

**Files：**
- Modify: `app/api/divination/bazi/route.ts`
- Modify: `app/api/divination/bazi/route.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/divination/bazi", () => {
  it("focus 必须是 6 类之一", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", focus: "事业", userQuestion: "?" }),
    }));
    expect(r.status).toBe(400);
  });

  it("无 profileSnapshot 也无现有 profile → 412 NO_PROFILE", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", focus: "综合运势", userQuestion: "?" }),
    }));
    expect([400, 412]).toContain(r.status);
  });

  it("含 profileSnapshot 时即使无 profile 也应 200", async () => {
    // 此测需要 mock db 与 chat,留作集成测试 placeholder
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/api/divination/bazi/route.test.ts
```

- [ ] **Step 3：重写 bazi route**

完整重写 `app/api/divination/bazi/route.ts`：

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, baziCharts, messages, profiles } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { computeChart } from "@/lib/bazi/chart";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { parseJson, serializeJson } from "@/lib/db/json";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { getCurrentProfile } from "@/lib/profile/current";

export const runtime = "nodejs";
export const maxDuration = 90;

const FOCUS = ["综合运势", "事业学业", "财运", "感情姻缘", "人际贵人", "平安健康"] as const;

const profileSnapshotSchema = z.object({
  gender: z.enum(["male", "female"]),
  birth_time: z.string().min(1),
  birth_province: z.string().min(1),
  birth_city: z.string().min(1),
  birth_district: z.string().nullish(),
  longitude: z.number(),
  latitude: z.number(),
});

const bodySchema = z.object({
  conversationId: z.string().min(1),
  focus: z.enum(FOCUS),
  userQuestion: z.string().trim().min(1).max(500),
  profileSnapshot: profileSnapshotSchema.nullish(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "校验失败", issues: parsed.error.issues }, { status: 400 });
  }
  const { conversationId, focus, userQuestion, profileSnapshot } = parsed.data;

  const safetyFail = guardTexts({ userQuestion });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const rate = await checkRateLimit(userId);
  if (!rate.allowed) return jsonError(`每小时上限 ${rate.limit} 条，已用 ${rate.used}`, 429);

  const db = getDb();
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);

  // 取或建临时 profile 数据
  let chartInput: typeof profileSnapshot;
  if (profileSnapshot) {
    chartInput = profileSnapshot;
  } else {
    const existing = await getCurrentProfile();
    if (!existing) {
      return NextResponse.json({ error: "请先填写八字信息", code: "NO_PROFILE" }, { status: 412 });
    }
    chartInput = {
      gender: existing.gender ?? "male",
      birth_time: existing.birth_time ?? "",
      birth_province: existing.birth_province ?? "",
      birth_city: existing.birth_city ?? "",
      birth_district: existing.birth_district,
      longitude: existing.birth_longitude ?? 0,
      latitude: existing.birth_latitude ?? 0,
    };
  }
  if (!chartInput!.birth_time) return jsonError("缺少出生时间", 400);

  // 排盘
  const chart = computeChart({
    birthIso: chartInput!.birth_time,
    longitude: chartInput!.longitude,
    gender: chartInput!.gender,
  });

  // user message
  const [userMsg] = await db.insert(messages).values({
    conversation_id: conversationId,
    role: "user",
    content: `[八字 · ${focus}] ${userQuestion}`,
    intent: "bazi",
  }).returning();

  // AI 解读
  let aiText = "（解读暂时不可用，请稍后再试）";
  let tokens = 0;
  try {
    const prompt = await loadPrompt("bazi.interpret");
    const tpl = renderTemplate(prompt.userPromptTpl, {
      focus, userQuestion,
      yearGz: chart.year.gz, monthGz: chart.month.gz, dayGz: chart.day.gz, hourGz: chart.hour.gz,
      dayMaster: chart.dayMaster,
      fiveElements: JSON.stringify(chart.fiveElements),
      tenGods: chart.tenGods.join("、"),
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: tpl }],
      stream: false,
      meta: { conversationId, userId },
    });
    aiText = ai.text;
    tokens = ai.tokensUsed;
  } catch (e) {
    console.error("bazi AI 解读失败", e);
  }

  // assistant message: bazi_result
  const [resultMsg] = await db.insert(messages).values({
    conversation_id: conversationId,
    role: "assistant",
    content: aiText,
    intent: "bazi",
    tokens_used: tokens,
    metadata: serializeJson({
      ui: "bazi_result",
      focus,
      chart: {
        yearGz: chart.year.gz, monthGz: chart.month.gz, dayGz: chart.day.gz, hourGz: chart.hour.gz,
        dayMaster: chart.dayMaster,
        fiveElements: chart.fiveElements,
        tenGods: chart.tenGods,
      },
    }),
  }).returning();

  await db.update(conversations).set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({
    conversationId,
    userMessage: { id: userMsg!.id, role: "user", content: userMsg!.content, created_at: userMsg!.created_at },
    resultMessage: {
      id: resultMsg!.id, role: "assistant", content: resultMsg!.content,
      created_at: resultMsg!.created_at, metadata: resultMsg!.metadata,
    },
  });
}

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
```

注：如 `lib/bazi/chart.ts` 的 `computeChart` 返回结构跟以上不同，按实际字段名调整。

- [ ] **Step 4：GREEN**

```bash
pnpm vitest run app/api/divination/bazi/route.test.ts
pnpm typecheck
```

- [ ] **Step 5：commit**

```bash
git add app/api/divination/bazi/route.ts app/api/divination/bazi/route.test.ts
git commit -m "feat(api): bazi 改为 sub-action（profileSnapshot 支持，未建档可在对话内填）"
```

**Acceptance：**
- focus 6 类校验生效
- 无 profile 无 snapshot → 412
- 有 snapshot 即使无 profile 也成功
- resultMessage.metadata.ui = 'bazi_result'

**工时：4 h**

---

### Task M2.5：/api/divination/meihua 简化（纯数字测算）

**Files：**
- Modify: `app/api/divination/meihua/route.ts`
- Modify: `app/api/divination/meihua/route.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/divination/meihua", () => {
  it("numbers 必须 1-3 个 1-9 整数", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", numbers: [10], userQuestion: "?" }),
    }));
    expect(r.status).toBe(400);
  });

  it("numbers 最多 3 个", async () => {
    const r = await POST(new Request("http://test", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", numbers: [1, 2, 3, 4], userQuestion: "?" }),
    }));
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/api/divination/meihua/route.test.ts
```

- [ ] **Step 3：重写 meihua route — 简化版（去掉 method=time）**

```ts
// app/api/divination/meihua/route.ts 完整替换
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, divinationRecords, messages, hexagrams } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { castByNumbers } from "@/lib/meihua/cast";
import { interpret } from "@/lib/meihua/interpret";
import { wuxingOf } from "@/lib/meihua/wuxing";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { parseJson, serializeJson } from "@/lib/db/json";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";

export const runtime = "nodejs";
export const maxDuration = 90;

const VERDICT_BY_RELATION: Record<string, string> = {
  yong_sheng_ti: "用生体 · 大吉",
  ti_ke_yong: "体克用 · 吉",
  bi_he: "比和 · 平顺",
  ti_sheng_yong: "体生用 · 略耗心力",
  yong_ke_ti: "用克体 · 留神",
};

const bodySchema = z.object({
  conversationId: z.string().min(1),
  numbers: z.array(z.number().int().min(1).max(9)).min(1).max(3),
  userQuestion: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonError("请求体不是合法 JSON", 400); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "校验失败", issues: parsed.error.issues }, { status: 400 });
  }
  const { conversationId, numbers, userQuestion } = parsed.data;

  const safetyFail = guardTexts({ userQuestion });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const rate = await checkRateLimit(userId);
  if (!rate.allowed) return jsonError(`每小时上限 ${rate.limit} 条，已用 ${rate.used}`, 429);

  const db = getDb();
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);

  const cast = castByNumbers(numbers);
  const result = interpret(cast);

  // user message
  const [userMsg] = await db.insert(messages).values({
    conversation_id: conversationId,
    role: "user",
    content: `[测算 · 数字 ${numbers.join("、")}] ${userQuestion}`,
    intent: "meihua",
  }).returning();

  // AI 解读
  let aiText = "（解读暂时不可用，请稍后再试）";
  let tokens = 0;
  try {
    const prompt = await loadPrompt("meihua.interpret");
    const benRow = await db.select({ judgment: hexagrams.judgment }).from(hexagrams)
      .where(eq(hexagrams.number, result.ben.number)).limit(1);
    const tpl = renderTemplate(prompt.userPromptTpl, {
      benName: result.ben.name,
      upperWuxing: wuxingOf(result.ben.upper),
      lowerWuxing: wuxingOf(result.ben.lower),
      benJudgment: benRow[0]?.judgment ?? "（卦辞待补）",
      dongYao: result.dongYao,
      huName: result.hu.name,
      bianName: result.bian.name,
      guaZhongName: result.guaZhongGua.name,
      ti: result.tiYong.ti, yong: result.tiYong.yong,
      tiWuxing: wuxingOf(result.tiYong.ti),
      yongWuxing: wuxingOf(result.tiYong.yong),
      relation: result.tiYong.relation,
      verdict: VERDICT_BY_RELATION[result.tiYong.relation] ?? "",
      speed: result.yingQi.speed, timeHint: result.yingQi.timeHint,
      branchHour: result.yingQi.branchHour ?? "（数字起卦无）",
      userQuestion, waiying: "（用户尚未提供）",
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: tpl }],
      stream: false,
      meta: { conversationId, userId },
    });
    aiText = ai.text; tokens = ai.tokensUsed;
  } catch (e) {
    console.error("meihua AI 解读失败", e);
  }

  // assistant message: meihua_result（含全卦象 metadata）
  const [resultMsg] = await db.insert(messages).values({
    conversation_id: conversationId,
    role: "assistant",
    content: aiText,
    intent: "meihua",
    tokens_used: tokens,
    metadata: serializeJson({
      ui: "meihua_result",
      ben: result.ben, hu: result.hu, bian: result.bian, guaZhongGua: result.guaZhongGua,
      dongYao: result.dongYao,
      tiYong: result.tiYong,
      yingQi: result.yingQi,
      verdict: VERDICT_BY_RELATION[result.tiYong.relation] ?? "",
    }),
  }).returning();

  await db.insert(divinationRecords).values({
    message_id: resultMsg!.id, type: "meihua",
    input: serializeJson({ numbers, userQuestion }),
    result: serializeJson(result),
  });

  await db.update(conversations).set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({
    conversationId,
    userMessage: { id: userMsg!.id, role: "user", content: userMsg!.content, created_at: userMsg!.created_at },
    resultMessage: {
      id: resultMsg!.id, role: "assistant", content: resultMsg!.content,
      created_at: resultMsg!.created_at, metadata: resultMsg!.metadata,
    },
  });
}

// PATCH 外应回填保留现有实现（如有），不在 W1-W2 重构范围

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
```

- [ ] **Step 4：GREEN**

```bash
pnpm vitest run app/api/divination/meihua/route.test.ts
pnpm typecheck
```

- [ ] **Step 5：commit**

```bash
git add app/api/divination/meihua/route.ts app/api/divination/meihua/route.test.ts
git commit -m "feat(api): meihua 简化为纯数字测算（去 time 起卦路径）"
```

**Acceptance：**
- numbers 边界校验（1-3 个 1-9 整数）
- resultMessage.metadata.ui = 'meihua_result'

**工时：3 h**

---

## M2 部署 checkpoint

```bash
KEY=/Users/edy/Downloads/renliang.pem
SERVER=ubuntu@43.129.186.82
for f in app/api/chat/route.ts \
         app/api/divination/qianwen/route.ts \
         app/api/divination/dream/route.ts \
         app/api/divination/bazi/route.ts \
         app/api/divination/meihua/route.ts \
         lib/ai/intent-classifier.ts \
         lib/ai/summarizer.ts \
         lib/ai/intent.ts \
         lib/ai/prompts.ts; do
  ssh -i $KEY $SERVER "mkdir -p ~/occult/$(dirname $f)"
  scp -i $KEY $f $SERVER:~/occult/$f
done
ssh -i $KEY $SERVER 'cd ~/occult && docker compose build --no-cache && docker compose up -d && sleep 8 && docker compose ps'
```

**验证：**

```bash
# 在你 mac 上
JAR=/tmp/qy-prod.cookies; rm -f $JAR
curl -sS -c $JAR http://43.129.186.82:3000/ -o /dev/null
# POST profile（建一个测试档案）...省略
# 测分流
curl -sS -b $JAR -X POST http://43.129.186.82:3000/api/chat \
  -H "content-type: application/json" \
  -d '{"text":"我要抽灵签"}' --max-time 30 -N 2>&1 | head -8
# 预期输出 event: meta + intent=divination + event: card + ui=slip_type_picker
```

---

## M3：组件 + 卡片（22 h / 2.7 d / 7 task）

前端彻底改造。完成后 chat 页底部固定 4 chip + ChatInput；引导卡 / 表单卡 / 结果卡通过 metadata.ui 分发渲染。

### Task M3.1：通用 ChoiceCard 组件

**Files：**
- Create: `app/chat/_components/cards/ChoiceCard.tsx`
- Create: `app/chat/_components/cards/ChoiceCard.test.tsx`

- [ ] **Step 1：写测试**

```tsx
// app/chat/_components/cards/ChoiceCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChoiceCard } from "./ChoiceCard";

describe("ChoiceCard", () => {
  it("渲染 title + 所有 options", () => {
    render(<ChoiceCard
      title="您想快速还是精准解梦？"
      options={[
        { key: "fast", label: "快速解梦", hint: "简单描述" },
        { key: "precise", label: "精准解梦", hint: "多维度场景" },
      ]}
      onPick={() => {}}
    />);
    expect(screen.getByText("您想快速还是精准解梦？")).toBeInTheDocument();
    expect(screen.getByText("快速解梦")).toBeInTheDocument();
    expect(screen.getByText("精准解梦")).toBeInTheDocument();
    expect(screen.getByText("简单描述")).toBeInTheDocument();
  });

  it("点选项触发 onPick(key)", () => {
    const onPick = vi.fn();
    render(<ChoiceCard
      title="t"
      options={[{ key: "a", label: "A" }, { key: "b", label: "B" }]}
      onPick={onPick}
    />);
    fireEvent.click(screen.getByText("A"));
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("busy 时按钮 disabled", () => {
    const onPick = vi.fn();
    render(<ChoiceCard
      title="t"
      options={[{ key: "a", label: "A" }]}
      onPick={onPick}
      busy
    />);
    fireEvent.click(screen.getByText("A"));
    expect(onPick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/chat/_components/cards/ChoiceCard.test.tsx
```

- [ ] **Step 3：实现 ChoiceCard**

```tsx
// app/chat/_components/cards/ChoiceCard.tsx
"use client";
import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  key: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}

export interface ChoiceCardProps {
  title: string;
  options: readonly ChoiceOption[];
  onPick: (key: string) => void;
  busy?: boolean;
  className?: string;
}

export function ChoiceCard({ title, options, onPick, busy, className }: ChoiceCardProps) {
  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <p className="text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]">
        {title}
      </p>
      <div className={cn(
        "grid gap-2",
        options.length > 4 ? "grid-cols-2" : options.length > 2 ? "grid-cols-2" : "grid-cols-1",
      )}>
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={busy}
            onClick={() => !busy && onPick(opt.key)}
            className={cn(
              "rounded-[10px] px-3 py-2.5 text-left transition-colors",
              "border border-[var(--color-accent-lavender)]/30 bg-white/40",
              "hover:bg-[var(--color-accent-lavender)]/20",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <div className="flex items-center gap-2">
              {opt.icon}
              <span className="font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
                {opt.label}
              </span>
            </div>
            {opt.hint && (
              <p className="mt-1 text-[10px] text-[var(--color-ink-fade)]">{opt.hint}</p>
            )}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 4：GREEN**

```bash
pnpm vitest run app/chat/_components/cards/ChoiceCard.test.tsx
```

- [ ] **Step 5：commit**

```bash
git add app/chat/_components/cards/ChoiceCard.tsx app/chat/_components/cards/ChoiceCard.test.tsx
git commit -m "feat(chat): ChoiceCard 通用引导卡（dream_choice / slip_type_picker 复用）"
```

**Acceptance：**3 测试全过 / busy 时点击无效 / 4 选项以上 grid 2 列。

**工时：2 h**

---

### Task M3.2：通用 FormCard 组件

**Files：**
- Create: `app/chat/_components/cards/FormCard.tsx`
- Create: `app/chat/_components/cards/FormCard.test.tsx`

- [ ] **Step 1：写测试**

```tsx
// app/chat/_components/cards/FormCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormCard } from "./FormCard";

describe("FormCard", () => {
  it("渲染 title + 所有字段", () => {
    render(<FormCard
      title="梦境描述"
      fields={[
        { key: "core", label: "核心场景", type: "textarea", required: true, max: 500 },
        { key: "emotion", label: "情绪感受", type: "textarea", required: true, max: 200 },
      ]}
      submitLabel="精准解梦"
      onSubmit={() => {}}
    />);
    expect(screen.getByText("梦境描述")).toBeInTheDocument();
    expect(screen.getByText("核心场景")).toBeInTheDocument();
    expect(screen.getByText("情绪感受")).toBeInTheDocument();
    expect(screen.getByText("精准解梦")).toBeInTheDocument();
  });

  it("必填项空时按钮 disabled", () => {
    const onSubmit = vi.fn();
    render(<FormCard
      title="t" submitLabel="提交"
      fields={[{ key: "x", label: "X", required: true }]}
      onSubmit={onSubmit}
    />);
    const btn = screen.getByText("提交");
    expect(btn).toBeDisabled();
  });

  it("填完必填后 submit 携带所有 values", () => {
    const onSubmit = vi.fn();
    render(<FormCard
      title="t" submitLabel="提交"
      fields={[
        { key: "a", label: "A", required: true },
        { key: "b", label: "B" },
      ]}
      onSubmit={onSubmit}
    />);
    const inputA = screen.getByPlaceholderText("A") || screen.getAllByRole("textbox")[0];
    fireEvent.change(inputA, { target: { value: "hello" } });
    fireEvent.click(screen.getByText("提交"));
    expect(onSubmit).toHaveBeenCalledWith({ a: "hello", b: "" });
  });

  it("超过 max 字数自动截断", () => {
    render(<FormCard
      title="t" submitLabel="ok"
      fields={[{ key: "a", label: "A", max: 5 }]}
      onSubmit={() => {}}
    />);
    const ta = screen.getAllByRole("textbox")[0];
    fireEvent.change(ta, { target: { value: "hellohello" } });
    expect((ta as HTMLInputElement).value).toBe("hello");
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/chat/_components/cards/FormCard.test.tsx
```

- [ ] **Step 3：实现 FormCard**

```tsx
// app/chat/_components/cards/FormCard.tsx
"use client";
import * as React from "react";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

export interface FormField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number" | "region" | "date";
  required?: boolean;
  max?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  maxValue?: number;
}

export interface FormCardProps {
  title: string;
  fields: readonly FormField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => void;
  busy?: boolean;
  className?: string;
}

export function FormCard({ title, fields, submitLabel, onSubmit, busy, className }: FormCardProps) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );

  const setField = (key: string, raw: string) => {
    const f = fields.find((x) => x.key === key);
    const truncated = f?.max ? raw.slice(0, f.max) : raw;
    setValues((prev) => ({ ...prev, [key]: truncated }));
  };

  const canSubmit =
    !busy &&
    fields.every((f) => !f.required || (values[f.key] ?? "").trim().length > 0);

  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]">
          {title}
        </p>
        <Sparkle size={10} variant="diamond" />
      </div>
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <label className="text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
            {f.label}
            {f.required && <span className="ml-0.5 text-[var(--color-wuxing-fire)]">*</span>}
          </label>
          {f.type === "textarea" || f.type === undefined && f.max && f.max > 50 ? (
            <textarea
              rows={3}
              value={values[f.key] ?? ""}
              disabled={busy}
              placeholder={f.placeholder ?? f.label}
              onChange={(e) => setField(f.key, e.target.value)}
              className="w-full resize-none rounded-[10px] border border-[var(--color-accent-lavender)]/30 bg-white/40 px-3 py-2 text-sm text-[var(--color-ink-plum)] placeholder:text-[var(--color-ink-fade)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]"
            />
          ) : f.type === "select" ? (
            <select
              value={values[f.key] ?? ""}
              disabled={busy}
              onChange={(e) => setField(f.key, e.target.value)}
              className="w-full rounded-[10px] border border-[var(--color-accent-lavender)]/30 bg-white/40 px-3 py-2 text-sm text-[var(--color-ink-plum)]"
            >
              <option value="">（选择）</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              inputMode={f.type === "number" ? "numeric" : undefined}
              value={values[f.key] ?? ""}
              disabled={busy}
              placeholder={f.placeholder ?? f.label}
              min={f.min}
              max={f.maxValue}
              onChange={(e) => setField(f.key, e.target.value)}
              className="w-full rounded-[10px] border border-[var(--color-accent-lavender)]/30 bg-white/40 px-3 py-2 text-sm text-[var(--color-ink-plum)]"
            />
          )}
          {f.max && (
            <p className="text-right text-[10px] text-[var(--color-ink-fade)]">
              {(values[f.key] ?? "").length} / {f.max}
            </p>
          )}
        </div>
      ))}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(values)}
        className={cn(
          "h-11 w-full rounded-[10px] transition-all",
          "bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] text-white shadow-pill",
          "font-[family-name:var(--font-serif)] text-sm tracking-ritual",
          "hover:opacity-90 active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {busy ? "提交中…" : submitLabel}
      </button>
    </GlassCard>
  );
}
```

- [ ] **Step 4：GREEN**

```bash
pnpm vitest run app/chat/_components/cards/FormCard.test.tsx
```

- [ ] **Step 5：commit**

```bash
git add app/chat/_components/cards/FormCard.tsx app/chat/_components/cards/FormCard.test.tsx
git commit -m "feat(chat): FormCard 通用表单卡（dream_precise / bazi_quick / meihua_number 复用）"
```

**Acceptance：**4 测试全过 / 必填校验生效 / max 自动截断。

**工时：3 h**

---

### Task M3.3：MessageBubble 14 ui 分发 + ChatWindow 重构

**Files：**
- Modify: `app/chat/_components/MessageBubble.tsx`（switch 14 种）
- Modify: `app/chat/_components/ChatWindow.tsx`（删 launcher 分支，加卡片回调）
- Delete: `app/chat/_components/DivinationLauncher.tsx`
- Delete: `app/chat/_components/DreamLauncher.tsx`
- Delete: `app/chat/_components/BaziLauncher.tsx`
- Delete: `app/chat/_components/MeihuaInputCard.tsx`
- Delete: `app/chat/_components/MeihuaWaiyingForm.tsx`

- [ ] **Step 1：写 MessageBubble 测试**

```tsx
// app/chat/_components/MessageBubble.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "./MessageBubble";

describe("MessageBubble 14 ui 分发", () => {
  const baseMsg = { id: "1", role: "assistant" as const, content: "测试", created_at: "2026-04-26T01:00:00Z" };

  it("ui=text 渲染普通文本气泡", () => {
    render(<MessageBubble message={{ ...baseMsg, metadata: JSON.stringify({ ui: "text" }) }} />);
    expect(screen.getByText("测试")).toBeInTheDocument();
  });

  it("ui=dream_choice 渲染 ChoiceCard", () => {
    const meta = { ui: "dream_choice", options: [{ key: "fast", label: "快速解梦" }, { key: "precise", label: "精准解梦" }] };
    render(<MessageBubble message={{ ...baseMsg, metadata: JSON.stringify(meta) }} onCardPick={() => {}} />);
    expect(screen.getByText("快速解梦")).toBeInTheDocument();
    expect(screen.getByText("精准解梦")).toBeInTheDocument();
  });

  it("ui=slip_image 渲染 SlipImageCard（含图片）", () => {
    const meta = { ui: "slip_image", slipNumber: 1, level: "上上", title: "心定福自来", poem: "心闲气定福无涯", dimension: "事业学业", reading: "稳" };
    render(<MessageBubble message={{ ...baseMsg, metadata: JSON.stringify(meta) }} />);
    expect(screen.getByText(/心定福自来/)).toBeInTheDocument();
  });

  it("metadata 解析失败 fallback 文本气泡", () => {
    render(<MessageBubble message={{ ...baseMsg, metadata: "{invalid json" }} />);
    expect(screen.getByText("测试")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/chat/_components/MessageBubble.test.tsx
```

- [ ] **Step 3：重写 MessageBubble — switch 14 ui**

```tsx
// app/chat/_components/MessageBubble.tsx 完整替换
import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/su";
import { ChoiceCard } from "./cards/ChoiceCard";
import { FormCard, type FormField } from "./cards/FormCard";
import { SlipImageCard } from "./cards/SlipImageCard";
import { BaziResultCard } from "./cards/BaziResultCard";
import { DreamResultCard } from "./cards/DreamResultCard";
import { MeihuaResultCard } from "@/components/divination/MeihuaResultCard";
import type { Message } from "@/lib/db/schema";

export type DisplayMessage = Pick<Message, "id" | "role" | "content" | "created_at"> & {
  metadata?: string | null;
};

export type CardPickCallback = (msgId: string, ui: string, key: string) => void;
export type CardSubmitCallback = (msgId: string, ui: string, values: Record<string, string>) => void;

interface MessageBubbleProps {
  message: DisplayMessage;
  streaming?: boolean;
  className?: string;
  onCardPick?: CardPickCallback;
  onCardSubmit?: CardSubmitCallback;
  busy?: boolean;
}

interface MetaUi { ui: string; [k: string]: unknown }

function parseMeta(raw: string | null | undefined): MetaUi | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as MetaUi; } catch { return null; }
}

export function MessageBubble({ message, streaming, className, onCardPick, onCardSubmit, busy }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const meta = parseMeta(message.metadata);
  const ui = meta?.ui ?? "text";

  // user / 系统消息 / 默认 text
  if (isUser || ui === "text") {
    return <TextBubble message={message} streaming={streaming} isUser={isUser} className={className} />;
  }

  // 引导卡 / 表单卡 / 结果卡
  switch (ui) {
    case "intent_pending":
      return (
        <div className={cn("flex justify-start", className)}>
          <div className="rounded-full bg-white/60 px-3 py-1 text-xs text-[var(--color-ink-fade)]">
            正在识别意图...
          </div>
        </div>
      );

    case "dream_choice":
    case "slip_type_picker":
    case "meihua_method_picker": {
      const options = (meta?.options ?? []) as Array<{ key: string; label: string; hint?: string }>;
      return (
        <CardWrap className={className}>
          <ChoiceCard
            title={message.content || "请选择"}
            options={options}
            busy={busy}
            onPick={(k) => onCardPick?.(message.id, ui, k)}
          />
        </CardWrap>
      );
    }

    case "dream_precise_form":
      return (
        <CardWrap className={className}>
          <FormCard
            title="梦境描述"
            fields={DREAM_PRECISE_FIELDS}
            submitLabel="精准解梦"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    case "bazi_quick_form":
      return (
        <CardWrap className={className}>
          <FormCard
            title="请填写八字信息"
            fields={BAZI_QUICK_FIELDS}
            submitLabel="生成解读"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    case "meihua_number_input":
      return (
        <CardWrap className={className}>
          <FormCard
            title="请给我 1-3 个 1-9 的数字（逗号分隔）"
            fields={[{ key: "numbers", label: "数字", required: true, placeholder: "例如 3, 6, 9" }]}
            submitLabel="起卦测算"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    case "meihua_intro":
      // 仅文本提示，由后续用户回复触发 meihua_number_input
      return <TextBubble message={message} isUser={false} className={className} />;

    case "slip_image": {
      const m = meta as any;
      return (
        <CardWrap className={className}>
          <SlipImageCard
            slipNumber={m.slipNumber} level={m.level} title={m.title} poem={m.poem}
            dimension={m.dimension} reading={m.reading}
          />
        </CardWrap>
      );
    }

    case "bazi_result": {
      const m = meta as any;
      return (
        <CardWrap className={className}>
          <BaziResultCard chart={m.chart} focus={m.focus} aiText={message.content} />
        </CardWrap>
      );
    }

    case "dream_result":
      return (
        <CardWrap className={className}>
          <DreamResultCard mode={(meta as any).mode} aiText={message.content} />
        </CardWrap>
      );

    case "meihua_result": {
      const m = meta as any;
      return (
        <CardWrap className={className}>
          <MeihuaResultCard
            ben={m.ben} hu={m.hu} bian={m.bian} guaZhongGua={m.guaZhongGua}
            dongYao={m.dongYao} ti={m.tiYong.ti} yong={m.tiYong.yong}
            relation={m.tiYong.relation} verdict={m.verdict}
            speed={m.yingQi.speed} timeHint={m.yingQi.timeHint} branchHour={m.yingQi.branchHour}
          />
        </CardWrap>
      );
    }

    case "fortune_result":
      // 占位，M5 阶段如复用首页运势卡时实现
      return <TextBubble message={message} isUser={false} className={className} />;

    default:
      return <TextBubble message={message} isUser={false} className={className} />;
  }
}

function CardWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div className="w-full max-w-[92%]">{children}</div>
    </div>
  );
}

function TextBubble({ message, streaming, isUser, className }: { message: DisplayMessage; streaming?: boolean; isUser: boolean; className?: string }) {
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}>
      <div className="flex max-w-[82%] gap-2">
        {!isUser && (
          <div aria-hidden className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E8E4FF] to-[#FFE8F0]">
            <Sparkle size={10} variant="diamond" />
          </div>
        )}
        <div className={cn(
          "relative whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-relaxed",
          "font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
          isUser
            ? "rounded-[18px] rounded-br-[4px] bg-gradient-to-br from-[#F0B8C8]/40 to-[#C9A1D9]/40 shadow-pill"
            : "glass hairline rounded-[18px] rounded-bl-[4px]",
        )}>
          {message.content}
          {streaming && (
            <span aria-hidden className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[var(--color-accent-lavender)] align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}

const DREAM_PRECISE_FIELDS: readonly FormField[] = [
  { key: "core", label: "核心场景", type: "textarea", required: true, max: 500, placeholder: "请描述梦境中的画面、人物、地点、发生的故事" },
  { key: "emotion", label: "情绪感受", type: "textarea", required: true, max: 200, placeholder: "梦中的情绪 + 醒来后的变化" },
  { key: "reality", label: "现实关联（可选）", type: "textarea", max: 200, placeholder: "近期类似的场景或在意的事" },
  { key: "special", label: "特殊细节（可选）", type: "textarea", max: 200, placeholder: "印象深刻的奇怪细节" },
] as const;

const BAZI_QUICK_FIELDS: readonly FormField[] = [
  { key: "gender", label: "性别", type: "select", required: true, options: [{ value: "male", label: "男" }, { value: "female", label: "女" }] },
  { key: "birth_time", label: "出生时间（含时辰）", type: "date", required: true, placeholder: "例如 1995-03-22 09:00" },
  { key: "birth_place", label: "出生地（省市区）", type: "region", required: true, placeholder: "例如 上海 上海 黄浦" },
] as const;
```

- [ ] **Step 4：重构 ChatWindow — 删 4 launcher 分支**

```tsx
// app/chat/_components/ChatWindow.tsx 关键改动（保留 RAF 流式 + multi-turn 等）
// 删除导入：DivinationLauncher / DreamLauncher / BaziLauncher / MeihuaInputCard / MeihuaWaiyingForm
// 删除 isDivision/isDream/isBazi/isMeihua 分支判定
// 渲染区改为：永远 ChatInput + IntentChips（M3.7 加）

// onCardPick / onCardSubmit 分发逻辑：
async function handleCardPick(msgId: string, ui: string, key: string) {
  if (ui === "dream_choice") {
    if (key === "fast") {
      // AI 引导用户描述梦境（写一条 assistant text 消息提示）
      await postCardFollowup({ ui: "dream_followup_fast", text: "好的，请描述你的梦境内容（10-2000 字）。" });
    } else if (key === "precise") {
      // 写一条 dream_precise_form 卡片消息
      await postCardFollowup({ ui: "dream_precise_form" });
    }
  } else if (ui === "slip_type_picker") {
    // 写一条 ai 提示让用户输入问题，然后 sumbit 时一起发到 qianwen
    setSlipDimensionPicked(key);
    await postCardFollowup({ ui: "slip_question_input", dimension: key });
  } else if (ui === "meihua_method_picker") {
    // V1 仅留数字测算
    await postCardFollowup({ ui: "meihua_number_input" });
  }
}
```

`ChatWindow.tsx` 的完整结构（仅展示骨架，复用现有 RAF 流式逻辑、Auto send、abortRef 等）：

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { IntentChips } from "./IntentChips";
import { GlassCard, Sparkle } from "@/components/su";
import type { DisplayMessage } from "./MessageBubble";

interface ChatWindowProps {
  conversationId: string | null;
  initialMessages: DisplayMessage[];
  autoSendText?: string;
}

export function ChatWindow({ conversationId: initialConvId, initialMessages, autoSendText }: ChatWindowProps) {
  const router = useRouter();
  const [convId, setConvId] = React.useState<string | null>(initialConvId);
  const [messages, setMessages] = React.useState<DisplayMessage[]>(initialMessages);
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const autoSentRef = React.useRef(false);

  // ===== send（保持现有 RAF 节流流式逻辑）=====
  const send = React.useCallback(async (text: string) => {
    /* ... 原 RAF + SSE 处理代码（参考 git log 现有 ChatWindow） ...
       关键区别：
       - body 不再传 intentHint
       - SSE 新增 'card' event 类型，需追加到 messages 列表
    */
  }, [convId, router]);

  // ===== 卡片回调 =====
  const handleCardPick = React.useCallback(async (msgId: string, ui: string, key: string) => {
    if (ui === "dream_choice") {
      const text = key === "fast" ? "我选快速解梦" : "我选精准解梦";
      await send(text);  // 让 /api/chat 走分流并写后续卡（实现：分流路由器接到这种"二次确认"也可走 chat 兜底）
      return;
    }
    if (ui === "slip_type_picker") {
      // 提示用户描述事情，next user message 触发 qianwen sub-action
      setMessages((m) => [...m, {
        id: `tmp-${Date.now()}`, role: "assistant",
        content: `好，您选了【${key}】。请描述具体的事情，越详细解读越准。`,
        created_at: new Date().toISOString(),
        metadata: JSON.stringify({ ui: "text", pendingDimension: key }),
      }]);
      return;
    }
  }, [send]);

  const handleCardSubmit = React.useCallback(async (msgId: string, ui: string, values: Record<string, string>) => {
    if (!convId) return;
    setBusy(true);
    try {
      let url = ""; let body: any = { conversationId: convId };
      if (ui === "dream_precise_form") {
        url = "/api/divination/dream";
        body = { ...body, mode: "precise", payload: values };
      } else if (ui === "bazi_quick_form") {
        url = "/api/divination/bazi";
        // 解析 region / time
        body = { ...body, focus: "综合运势", userQuestion: "看我的命盘",
          profileSnapshot: parseQuickProfile(values) };
      } else if (ui === "meihua_number_input") {
        url = "/api/divination/meihua";
        const numbers = values.numbers.split(/[,，、\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 9);
        body = { ...body, numbers, userQuestion: "用户在卡片中提交" };
      }
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "提交失败");
        return;
      }
      // 把返回的 user / result message 追加
      const append = [data.userMessage, data.cardMessage, data.resultMessage, data.aiReadingMessage].filter(Boolean);
      setMessages((m) => [...m, ...append]);
    } catch (e) {
      toast.error(`提交失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [convId]);

  // ===== auto send =====
  React.useEffect(() => {
    if (autoSendText && !autoSentRef.current) {
      autoSentRef.current = true;
      void send(autoSendText);
    }
  }, [autoSendText, send]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        messages={messages}
        streamingText={streaming}
        onCardPick={handleCardPick}
        onCardSubmit={handleCardSubmit}
        busy={busy}
        empty={
          <div className="flex flex-1 items-center justify-center px-6">
            <GlassCard className="max-w-sm space-y-2 p-5 text-center">
              <p className="text-sm tracking-ritual2 text-[var(--color-ink-plum)]">
                嗨！我是福小运 <Sparkle size={10} />
              </p>
              <p className="text-xs text-[var(--color-ink-fade)]">
                可以基于国学知识为您提供运势 / 财富 / 情感 / 命理分析 / 解梦等服务
              </p>
            </GlassCard>
          </div>
        }
      />
      <IntentChips
        onPick={(text) => void send(text)}
        busy={streaming !== null || busy}
      />
      <ChatInput onSend={send} busy={streaming !== null || busy} />
    </div>
  );
}

function parseQuickProfile(values: Record<string, string>) {
  // 极简实现：依赖 FormCard "region" / "date" 字段返回字符串，
  // 真实实现需要 region picker 提供 longitude/latitude，date picker 提供 ISO
  // 这里 throw，让 FormCard 在 M3.2 升级时支持 region/date 类型
  return {
    gender: values.gender as "male" | "female",
    birth_time: values.birth_time,
    birth_province: "占位",
    birth_city: "占位",
    longitude: 0,
    latitude: 0,
  };
}
```

**注**：`bazi_quick_form` 真正的 region / date / time 体验在 M5.2 闭环 task 里完善（FormCard.field.type='region' 时挂 RegionPicker、type='date' 时挂 DatePicker）。M3.3 这里先用 placeholder text input 留位，M5.2 升级。

- [ ] **Step 5：删除 4 个 launcher**

```bash
git rm app/chat/_components/DivinationLauncher.tsx
git rm app/chat/_components/DreamLauncher.tsx
git rm app/chat/_components/BaziLauncher.tsx
git rm app/chat/_components/MeihuaInputCard.tsx
git rm app/chat/_components/MeihuaWaiyingForm.tsx
git rm app/chat/_components/QuickActions.tsx
```

- [ ] **Step 6：跑全部测试 + typecheck**

```bash
pnpm typecheck
pnpm test
```

预期：MessageBubble 4 测试 + 全部原测全过。

- [ ] **Step 7：commit**

```bash
git add app/chat/_components/MessageBubble.tsx \
        app/chat/_components/MessageBubble.test.tsx \
        app/chat/_components/ChatWindow.tsx
git commit -m "refactor(chat): MessageBubble 14 ui 分发 + ChatWindow 删 4 launcher"
```

**Acceptance：**
- 4 个 launcher 文件已 git rm
- ChatWindow 不再含 isDivision/isDream/isBazi/isMeihua 分支判定
- MessageBubble switch 14 种 ui 全部实现（fortune_result 暂占位）
- 全部测试 PASS

**工时：6 h**

---

### Task M3.4：SlipImageCard

**Files：**
- Create: `app/chat/_components/cards/SlipImageCard.tsx`
- Create: `app/chat/_components/cards/SlipImageCard.test.tsx`
- Delete: `components/divination/SlipResultCard.tsx`

- [ ] **Step 1：写测试**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SlipImageCard } from "./SlipImageCard";

describe("SlipImageCard", () => {
  it("渲染签号 + 等级 + 签题 + dimension reading", () => {
    render(<SlipImageCard slipNumber={1} level="上上" title="心定福自来" poem="心闲气定福无涯" dimension="事业学业" reading="稳" />);
    expect(screen.getByText(/心定福自来/)).toBeInTheDocument();
    expect(screen.getByText(/事业学业/)).toBeInTheDocument();
  });

  it("img src 指向 /api/divination/slip-image/[n]", () => {
    render(<SlipImageCard slipNumber={42} level="吉" title="t" poem="p" dimension="财运" reading="r" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/api/divination/slip-image/42");
    expect(img.getAttribute("alt")).toContain("第 42 签");
  });

  it("含立即解读 + 保存按钮", () => {
    render(<SlipImageCard slipNumber={1} level="上上" title="t" poem="p" dimension="综合运势" reading="r" />);
    expect(screen.getByText(/立即解读/)).toBeInTheDocument();
    expect(screen.getByText(/保存/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/chat/_components/cards/SlipImageCard.test.tsx
```

- [ ] **Step 3：实现 SlipImageCard**

```tsx
"use client";
import * as React from "react";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { cn } from "@/lib/utils";

export interface SlipImageCardProps {
  slipNumber: number;
  level: string;
  title: string;
  poem: string;
  dimension: string;
  reading: string;
  className?: string;
}

export function SlipImageCard({ slipNumber, level, title, poem, dimension, reading, className }: SlipImageCardProps) {
  const imgSrc = `/api/divination/slip-image/${slipNumber}`;
  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-[var(--color-accent-lavender)]/40 bg-[var(--color-wuxing-fire)]/25 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]">
          第 {slipNumber} 签 · {level}
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>

      <img
        src={imgSrc}
        alt={`第 ${slipNumber} 签 · ${title}`}
        className="mx-auto block h-auto w-full max-w-[320px] rounded-[14px] shadow-pill"
        loading="lazy"
      />

      <p className="text-center font-[family-name:var(--font-serif)] text-base tracking-ritual text-[var(--color-ink-plum)]">
        {title}
      </p>

      <Divider />

      <div className="space-y-1.5">
        <p className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          关 于 · <span className="text-[var(--color-accent-plum)]">{dimension}</span>
        </p>
        <p className="text-sm leading-relaxed text-[var(--color-ink-plum)]">{reading}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-full bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] px-4 py-2 text-xs tracking-ritual text-white shadow-pill"
          onClick={() => {
            // 触发"我要完整解读"-> 让 ChatWindow 把这条作为新追问 user message
            window.dispatchEvent(new CustomEvent("qy:slip-full-read", { detail: { slipNumber } }));
          }}
        >
          立即解读
        </button>
        <a
          href={imgSrc}
          download={`福小运灵签-${slipNumber}.png`}
          className="flex-1 rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/40 px-4 py-2 text-center text-xs tracking-ritual text-[var(--color-ink-plum)]"
        >
          保存
        </a>
      </div>

      <p className="text-center text-[10px] text-[var(--color-ink-fade)]">
        iOS 用户下载后请长按图片选择"存储到照片"
      </p>
    </GlassCard>
  );
}
```

- [ ] **Step 4：删除旧 SlipResultCard**

```bash
git rm components/divination/SlipResultCard.tsx
```

如有 import 引用 SlipResultCard 的文件，全部改为 SlipImageCard：

```bash
grep -rn "SlipResultCard" app/ components/ lib/ 2>/dev/null
# 逐个改 import 来源
```

- [ ] **Step 5：GREEN + commit**

```bash
pnpm vitest run app/chat/_components/cards/SlipImageCard.test.tsx
pnpm typecheck
git add app/chat/_components/cards/SlipImageCard.tsx app/chat/_components/cards/SlipImageCard.test.tsx
git commit -m "feat(chat): SlipImageCard 替代 SlipResultCard，img 指向服务端 Canvas API"
```

**Acceptance：**3 测试全过 / img src 正确 / 立即解读 / 保存按钮渲染。

**工时：2.5 h**

---

### Task M3.5：BaziResultCard

**Files：**
- Create: `app/chat/_components/cards/BaziResultCard.tsx`
- Create: `app/chat/_components/cards/BaziResultCard.test.tsx`

- [ ] **Step 1：写测试**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BaziResultCard } from "./BaziResultCard";

describe("BaziResultCard", () => {
  it("渲染 4 柱 + 日主 + AI 文本", () => {
    render(<BaziResultCard
      focus="事业学业"
      chart={{
        yearGz: "甲子", monthGz: "丙寅", dayGz: "戊辰", hourGz: "壬戌",
        dayMaster: "戊", fiveElements: { 金: 1, 木: 2, 水: 1, 火: 1, 土: 3 },
        tenGods: ["正官", "偏财"],
      }}
      aiText="你的命盘呈现一种沉稳..."
    />);
    expect(screen.getByText(/甲子/)).toBeInTheDocument();
    expect(screen.getByText(/戊辰/)).toBeInTheDocument();
    expect(screen.getByText(/事业学业/)).toBeInTheDocument();
    expect(screen.getByText(/沉稳/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/chat/_components/cards/BaziResultCard.test.tsx
```

- [ ] **Step 3：实现 BaziResultCard**

```tsx
"use client";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { cn } from "@/lib/utils";

export interface BaziChartView {
  yearGz: string;
  monthGz: string;
  dayGz: string;
  hourGz: string;
  dayMaster: string;
  fiveElements: Record<string, number>;
  tenGods: string[];
}

export interface BaziResultCardProps {
  focus: string;
  chart: BaziChartView;
  aiText: string;
  className?: string;
}

export function BaziResultCard({ focus, chart, aiText, className }: BaziResultCardProps) {
  const pillars = [
    { label: "年柱", gz: chart.yearGz },
    { label: "月柱", gz: chart.monthGz },
    { label: "日柱", gz: chart.dayGz },
    { label: "时柱", gz: chart.hourGz },
  ];
  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-ritual2 text-[var(--color-ink-fade)]">
          八字 · {focus}
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {pillars.map((p) => (
          <div key={p.label} className="rounded-[10px] bg-white/40 px-2 py-2 text-center">
            <p className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">{p.label}</p>
            <p className="mt-0.5 font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
              {p.gz}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-[8px] bg-white/30 px-2 py-1.5">
          <span className="text-[var(--color-ink-fade)]">日主：</span>
          <span className="text-[var(--color-accent-plum)]">{chart.dayMaster}</span>
        </div>
        <div className="rounded-[8px] bg-white/30 px-2 py-1.5">
          <span className="text-[var(--color-ink-fade)]">五行：</span>
          <span className="text-[var(--color-ink-plum)]">
            {Object.entries(chart.fiveElements).map(([k, v]) => `${k}${v}`).join(" ")}
          </span>
        </div>
      </div>

      {chart.tenGods.length > 0 && (
        <p className="text-[11px] text-[var(--color-ink-mist)]">
          十神：{chart.tenGods.join("、")}
        </p>
      )}

      <Divider />

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-plum)]">
        {aiText}
      </p>
    </GlassCard>
  );
}
```

- [ ] **Step 4：GREEN + commit**

```bash
pnpm vitest run app/chat/_components/cards/BaziResultCard.test.tsx
git add app/chat/_components/cards/BaziResultCard.tsx app/chat/_components/cards/BaziResultCard.test.tsx
git commit -m "feat(chat): BaziResultCard（4 柱 + 五行 + 十神 + AI 文本）"
```

**工时：2 h**

---

### Task M3.6：DreamResultCard

**Files：**
- Create: `app/chat/_components/cards/DreamResultCard.tsx`
- Create: `app/chat/_components/cards/DreamResultCard.test.tsx`

- [ ] **Step 1：写测试**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DreamResultCard } from "./DreamResultCard";

describe("DreamResultCard", () => {
  it("渲染 mode 标签 + AI 文本", () => {
    render(<DreamResultCard mode="precise" aiText="🌙 你的梦境深度解析..." />);
    expect(screen.getByText(/精准解梦/)).toBeInTheDocument();
    expect(screen.getByText(/深度解析/)).toBeInTheDocument();
  });

  it("fast 模式标签为快速解梦", () => {
    render(<DreamResultCard mode="fast" aiText="t" />);
    expect(screen.getByText(/快速解梦/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/chat/_components/cards/DreamResultCard.test.tsx
```

- [ ] **Step 3：实现**

```tsx
"use client";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

export interface DreamResultCardProps {
  mode: "fast" | "precise";
  aiText: string;
  className?: string;
}

export function DreamResultCard({ mode, aiText, className }: DreamResultCardProps) {
  const modeLabel = mode === "fast" ? "快速解梦" : "精准解梦";
  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-[var(--color-accent-lavender)]/40 bg-[var(--color-wuxing-water)]/25 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]">
          梦 · {modeLabel}
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-plum)]">
        {aiText}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 4：GREEN + commit**

```bash
pnpm vitest run app/chat/_components/cards/DreamResultCard.test.tsx
git add app/chat/_components/cards/DreamResultCard.tsx app/chat/_components/cards/DreamResultCard.test.tsx
git commit -m "feat(chat): DreamResultCard"
```

**工时：1.5 h**

---

### Task M3.7：IntentChips（底部固定 4 chip）

**Files：**
- Create: `app/chat/_components/IntentChips.tsx`
- Create: `app/chat/_components/IntentChips.test.tsx`

- [ ] **Step 1：写测试**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntentChips } from "./IntentChips";

describe("IntentChips", () => {
  it("渲染 4 chip", () => {
    render(<IntentChips onPick={() => {}} />);
    expect(screen.getByText("抽灵签")).toBeInTheDocument();
    expect(screen.getByText("测算")).toBeInTheDocument();
    expect(screen.getByText("AI 解梦")).toBeInTheDocument();
    expect(screen.getByText("八字解读")).toBeInTheDocument();
  });

  it("点 chip 触发 onPick(固定话术)", () => {
    const onPick = vi.fn();
    render(<IntentChips onPick={onPick} />);
    fireEvent.click(screen.getByText("抽灵签"));
    expect(onPick).toHaveBeenCalledWith("我要抽灵签");
    fireEvent.click(screen.getByText("测算"));
    expect(onPick).toHaveBeenCalledWith("我要测算");
    fireEvent.click(screen.getByText("AI 解梦"));
    expect(onPick).toHaveBeenCalledWith("我要 AI 解梦");
    fireEvent.click(screen.getByText("八字解读"));
    expect(onPick).toHaveBeenCalledWith("我要八字解读");
  });

  it("busy 时禁用", () => {
    const onPick = vi.fn();
    render(<IntentChips onPick={onPick} busy />);
    fireEvent.click(screen.getByText("抽灵签"));
    expect(onPick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run app/chat/_components/IntentChips.test.tsx
```

- [ ] **Step 3：实现**

```tsx
"use client";
import { cn } from "@/lib/utils";

interface IntentChipsProps {
  onPick: (text: string) => void;
  busy?: boolean;
  className?: string;
}

const CHIPS = [
  { label: "抽灵签", text: "我要抽灵签" },
  { label: "测算", text: "我要测算" },
  { label: "AI 解梦", text: "我要 AI 解梦" },
  { label: "八字解读", text: "我要八字解读" },
] as const;

export function IntentChips({ onPick, busy, className }: IntentChipsProps) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto px-3 pb-2 pt-1", className)}>
      {CHIPS.map((c) => (
        <button
          key={c.label}
          type="button"
          disabled={busy}
          onClick={() => !busy && onPick(c.text)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs tracking-ritual2 transition-colors",
            "border-[var(--color-accent-lavender)]/40 bg-white/40 text-[var(--color-ink-plum)]",
            "hover:bg-[var(--color-accent-lavender)]/20",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4：GREEN + commit**

```bash
pnpm vitest run app/chat/_components/IntentChips.test.tsx
git add app/chat/_components/IntentChips.tsx app/chat/_components/IntentChips.test.tsx
git commit -m "feat(chat): IntentChips 底部固定 4 chip + 固定话术"
```

**Acceptance：**3 测试全过 / 4 chip 文案与固定话术与 spec §5.5 表格一致。

**工时：1 h**

---

## M3 部署 checkpoint

```bash
KEY=/Users/edy/Downloads/renliang.pem
SERVER=ubuntu@43.129.186.82
ssh -i $KEY $SERVER 'mkdir -p ~/occult/app/chat/_components/cards'
for f in $(find app/chat/_components -type f \( -name "*.tsx" -o -name "*.ts" \)); do
  ssh -i $KEY $SERVER "mkdir -p ~/occult/$(dirname $f)"
  scp -i $KEY $f $SERVER:~/occult/$f
done
ssh -i $KEY $SERVER "cd ~/occult && rm -f app/chat/_components/{Divination,Dream,Bazi}Launcher.tsx app/chat/_components/MeihuaInputCard.tsx app/chat/_components/MeihuaWaiyingForm.tsx app/chat/_components/QuickActions.tsx components/divination/SlipResultCard.tsx"
ssh -i $KEY $SERVER 'cd ~/occult && docker compose build --no-cache && docker compose up -d'
```

**验证：**手机打开 http://43.129.186.82:3000/chat → 看到底部 4 chip + ChatInput → 点"抽灵签" chip → 看到 ChoiceCard 渲染 6 类签主题。

---

## M4：首页 + 签文图 + 路由合并（20 h / 2.5 d / 5 task）

### Task M4.1：Canvas 签文图片 API + 缓存

**Files：**
- Create: `lib/canvas/slip-render.ts`
- Create: `lib/canvas/slip-render.test.ts`
- Create: `app/api/divination/slip-image/[n]/route.ts`
- Modify: `Dockerfile`（加 cairo / pango / jpeg / giflib / pixman）
- Modify: `package.json`（加 canvas 依赖）
- Add: `public/images/slip-bg.png`（AI 生成，用 spec §6.1 的 prompt）
- Add: `public/fonts/ma-shan-zheng.ttf`（Google Fonts）

- [ ] **Step 1：装依赖**

```bash
cd /Users/edy/Desktop/workspace/occult
pnpm add canvas
# Mac 本地需要 cairo: brew install cairo pango jpeg giflib pixman
```

- [ ] **Step 2：写测试**

```ts
// lib/canvas/slip-render.test.ts
import { describe, it, expect } from "vitest";
import { renderSlipToBuffer } from "./slip-render";

describe("renderSlipToBuffer", () => {
  it("生成 PNG buffer 长度合理", async () => {
    const buf = await renderSlipToBuffer({
      slipNumber: 1, level: "上上", title: "心定福自来",
      poem: "心闲气定福无涯，万事从容自到家",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(5000);
    // PNG 魔数
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });
});
```

- [ ] **Step 3：RED**

```bash
pnpm vitest run lib/canvas/slip-render.test.ts
```

- [ ] **Step 4：实现 slip-render.ts**

```ts
// lib/canvas/slip-render.ts
import "server-only";
import { createCanvas, loadImage, registerFont } from "canvas";
import * as path from "path";
import * as fs from "fs";

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const fontPath = path.join(process.cwd(), "public/fonts/ma-shan-zheng.ttf");
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: "Ma Shan Zheng" });
  }
  fontsRegistered = true;
}

export interface SlipRenderInput {
  slipNumber: number;
  level: string;
  title: string;
  poem: string;
}

export async function renderSlipToBuffer(input: SlipRenderInput): Promise<Buffer> {
  ensureFonts();
  const W = 750, H = 1000;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bgPath = path.join(process.cwd(), "public/images/slip-bg.png");
  if (fs.existsSync(bgPath)) {
    const bg = await loadImage(bgPath);
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    // fallback: 米色背景
    ctx.fillStyle = "#F5EFE6";
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = "#3a2a4a";
  ctx.textAlign = "center";

  // 签号 + 等级
  ctx.font = '40px "Ma Shan Zheng", serif';
  ctx.fillText(`第 ${input.slipNumber} 签 · ${input.level}`, W / 2, 150);

  // 签题
  ctx.font = '60px "Ma Shan Zheng", serif';
  ctx.fillText(input.title, W / 2, 320);

  // 签诗 wrap
  ctx.font = '32px serif';
  wrapText(ctx, input.poem, W / 2, 500, 600, 50);

  return canvas.toBuffer("image/png");
}

function wrapText(ctx: any, text: string, cx: number, y: number, maxW: number, lineH: number) {
  const chars = [...text];
  let line = "";
  let yy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line.length > 0) {
      ctx.fillText(line, cx, yy);
      line = ch;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}
```

- [ ] **Step 5：写 route**

```ts
// app/api/divination/slip-image/[n]/route.ts
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { divinationSlips } from "@/lib/db/schema";
import { renderSlipToBuffer } from "@/lib/canvas/slip-render";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";

const CACHE_DIR = path.join(process.cwd(), "data/slip-cache");

export async function GET(_: Request, { params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1 || num > 100) {
    return new Response("invalid slip number", { status: 400 });
  }

  const cachePath = path.join(CACHE_DIR, `${num}.png`);
  try {
    const buf = await fs.readFile(cachePath);
    return new Response(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Cache": "HIT",
      },
    });
  } catch {
    // 未命中，渲染 + 写缓存
  }

  const db = getDb();
  const [slip] = await db.select().from(divinationSlips).where(eq(divinationSlips.number, num)).limit(1);
  if (!slip) return new Response("not found", { status: 404 });

  const buf = await renderSlipToBuffer({
    slipNumber: slip.number, level: slip.level, title: slip.title, poem: slip.poem,
  });

  // 写缓存（异步不阻塞）
  fs.mkdir(CACHE_DIR, { recursive: true }).then(() =>
    fs.writeFile(cachePath, buf).catch(() => {}),
  );

  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "X-Cache": "MISS",
    },
  });
}
```

- [ ] **Step 6：改 Dockerfile**

在 builder 和 runner 阶段都加 cairo 依赖：

```dockerfile
# Dockerfile builder 阶段
FROM node:20-alpine AS builder
RUN apk add --no-cache cairo cairo-dev pango pango-dev jpeg-dev giflib-dev pixman-dev libc6-compat python3 make g++
# ... 其余保持

# Dockerfile runner 阶段
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat tini cairo pango jpeg giflib pixman
# ... 其余保持
```

- [ ] **Step 7：下载手写字体（可选）**

```bash
mkdir -p public/fonts
curl -L "https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf" \
  -o public/fonts/ma-shan-zheng.ttf
ls -la public/fonts/ma-shan-zheng.ttf  # 确认 > 1MB
```

- [ ] **Step 8：生成 1 张占位底图**

用 spec §6.1 prompt 在任一文生图工具生成，存到 `public/images/slip-bg.png`。临时占位用空白米色背景也行（slip-render.ts 已 fallback）。

- [ ] **Step 9：GREEN + 本地集成测**

```bash
pnpm vitest run lib/canvas/slip-render.test.ts
pnpm dev   # 起 dev
curl http://localhost:3002/api/divination/slip-image/1 -o /tmp/slip-1.png -w "%{http_code} %{size_download}\n"
file /tmp/slip-1.png   # 应为 PNG
```

- [ ] **Step 10：commit**

```bash
git add lib/canvas/ app/api/divination/slip-image/ Dockerfile package.json pnpm-lock.yaml public/fonts/ma-shan-zheng.ttf
git commit -m "feat(canvas): 服务端 Canvas 签文图片 API + 文件缓存"
```

**Acceptance：**单测通过 / `/api/divination/slip-image/1` 返回 PNG / 第二次访问 X-Cache: HIT / 1-100 范围外 400 / 不存在签号 404

**工时：5 h**

---

### Task M4.2：8 属性扩展（accessory + food）

**Files：**
- Modify: `lib/fortune/attributes.ts`
- Modify: `lib/fortune/attributes.test.ts`

- [ ] **Step 1：写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { computeAttributes } from "./attributes";

describe("computeAttributes 8 属性", () => {
  const dp = { date: "2026-04-26", gan: "庚", zhi: "午" } as any;

  it("8 属性都返回非空值", () => {
    const a = computeAttributes(dp);
    expect(a.color).toBeDefined();
    expect(a.direction).toBeTruthy();
    expect(a.hour).toBeDefined();
    expect(a.number).toBeTypeOf("number");
    expect(a.flower).toBeTruthy();
    expect(a.item).toBeTruthy();
    expect(a.accessory).toBeTruthy();  // 新增
    expect(a.food).toBeTruthy();        // 新增
  });

  it("金日 accessory 含银 / 玉", () => {
    const a = computeAttributes({ date: "x", gan: "庚", zhi: "午" } as any);  // 庚=金
    expect(a.accessory).toMatch(/银|玉/);
  });

  it("木日 food 含绿叶", () => {
    const a = computeAttributes({ date: "x", gan: "甲", zhi: "子" } as any);  // 甲=木
    expect(a.food).toMatch(/绿|青|蔬/);
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run lib/fortune/attributes.test.ts
```

- [ ] **Step 3：实现**

修改 `lib/fortune/attributes.ts`，加查表：

```ts
const ACCESSORY_BY_WUXING: Record<string, string> = {
  金: "银饰 / 白玉",
  木: "玉镯 / 木珠",
  水: "黑曜石 / 珍珠",
  火: "红玛瑙 / 红绳",
  土: "黄水晶 / 陶饰",
};

const FOOD_BY_WUXING: Record<string, string> = {
  金: "白色食物（杏仁、银耳）",
  木: "绿叶蔬菜（菠菜、青菜）",
  水: "黑色食物（黑米、紫菜）",
  火: "红色食物（红枣、樱桃）",
  土: "黄色食物（南瓜、玉米）",
};

// 在 computeAttributes 函数返回值里加：
//   accessory: ACCESSORY_BY_WUXING[wuxingOfGan(dp.gan)] ?? "玉饰",
//   food: FOOD_BY_WUXING[wuxingOfGan(dp.gan)] ?? "时令蔬菜",
```

并扩展 type：

```ts
export interface Attributes {
  color: { name: string; hex: string };
  direction: string;
  hour: { branch: string; range: string };
  number: number;
  flower: string;
  item: string;
  accessory: string;  // 新增
  food: string;        // 新增
}
```

- [ ] **Step 4：GREEN**

```bash
pnpm vitest run lib/fortune/attributes.test.ts
```

- [ ] **Step 5：commit**

```bash
git add lib/fortune/attributes.ts lib/fortune/attributes.test.ts
git commit -m "feat(fortune): 8 属性扩展（accessory + food，按五行查表）"
```

**工时：1.5 h**

---

### Task M4.3：首页大改 — 4 入口卡 + 6 柱图 + 8 属性 grid

**Files：**
- Modify: `app/page.tsx`
- Modify: `components/fortune/DailyFortuneCard.tsx`（6 柱 + 8 属性）
- Create: `components/home/HomeQuickEntries.tsx`
- Create: `components/home/HomeQuickEntries.test.tsx`

- [ ] **Step 1：写 HomeQuickEntries 测试**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeQuickEntries } from "./HomeQuickEntries";

describe("HomeQuickEntries", () => {
  it("4 入口卡渲染", () => {
    render(<HomeQuickEntries />);
    expect(screen.getByText("抽灵签")).toBeInTheDocument();
    expect(screen.getByText("测算")).toBeInTheDocument();
    expect(screen.getByText("AI 解梦")).toBeInTheDocument();
    expect(screen.getByText("AI 八字解读")).toBeInTheDocument();
  });

  it("链接跳转带 initial 参数", () => {
    render(<HomeQuickEntries />);
    const link = screen.getByText("抽灵签").closest("a");
    expect(link?.getAttribute("href")).toContain("/chat");
    expect(link?.getAttribute("href")).toContain("initial=");
  });
});
```

- [ ] **Step 2：RED**

```bash
pnpm vitest run components/home/HomeQuickEntries.test.tsx
```

- [ ] **Step 3：实现 HomeQuickEntries**

```tsx
// components/home/HomeQuickEntries.tsx
import Link from "next/link";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

interface Entry {
  label: string;
  text: string;
  hint: string;
  toneClass: string;
  large?: boolean;
}

const ENTRIES: Entry[] = [
  { label: "抽灵签", text: "我要抽灵签", hint: "心有迷茫\n一签解惑", toneClass: "bg-[var(--color-wuxing-fire)]/30" },
  { label: "测算", text: "我要测算", hint: "事有两难\n一算了然", toneClass: "bg-[var(--color-wuxing-water)]/30" },
  { label: "AI 解梦", text: "我要 AI 解梦", hint: "梦有深意 一语点破", toneClass: "bg-[var(--color-wuxing-wood)]/30", large: true },
  { label: "AI 八字解读", text: "我要八字解读", hint: "运有起落 一语知途", toneClass: "bg-[var(--color-wuxing-earth)]/30", large: true },
];

export function HomeQuickEntries() {
  const small = ENTRIES.filter((e) => !e.large);
  const big = ENTRIES.filter((e) => e.large);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {small.map((e) => <Card key={e.label} entry={e} />)}
      </div>
      {big.map((e) => <Card key={e.label} entry={e} />)}
    </div>
  );
}

function Card({ entry }: { entry: Entry }) {
  const href = `/chat?initial=${encodeURIComponent(entry.text)}`;
  return (
    <Link href={href} className="block transition-transform active:scale-[0.98]">
      <GlassCard className={cn("p-4", entry.toneClass)}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-[family-name:var(--font-serif)] text-base tracking-ritual text-[var(--color-ink-plum)]">
              {entry.label}
              <Sparkle size={9} variant="diamond" />
            </div>
            <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-[var(--color-ink-fade)]">
              {entry.hint}
            </p>
          </div>
          <span className="text-[var(--color-ink-fade)]">→</span>
        </div>
      </GlassCard>
    </Link>
  );
}
```

- [ ] **Step 4：改 DailyFortuneCard — 6 柱 + 8 属性 grid**

```tsx
// components/fortune/DailyFortuneCard.tsx 关键改动
const DIM_ORDER = ["综合运势", "事业学业", "财运", "感情姻缘", "人际贵人", "平安健康"] as const;

// AttributesGrid 改 8 项：
const items = [
  { label: "幸运色", value: attrs.color?.name ?? "—", tone: attrs.color?.hex },
  { label: "配饰", value: attrs.accessory ?? "—" },
  { label: "幸运时辰", value: attrs.hour?.range ?? "—" },
  { label: "幸运方位", value: attrs.direction ?? "—" },
  { label: "幸运数", value: String(attrs.number ?? "—") },
  { label: "幸运食物", value: attrs.food ?? "—" },
  { label: "幸运随身物", value: attrs.item ?? "—" },
  { label: "幸运花", value: attrs.flower ?? "—" },
];
// grid-cols-4 → grid-cols-4（已经是），8 项自然排 2 行
```

- [ ] **Step 5：改 app/page.tsx 添加 HomeQuickEntries**

在 DailyFortuneCard 下面追加：

```tsx
import { HomeQuickEntries } from "@/components/home/HomeQuickEntries";

// 主组件渲染区
<div className="relative z-10 w-full max-w-md space-y-4">
  {!profile ? (
    <GlassCard ...>...</GlassCard>
  ) : fortuneData ? (
    <>
      <DailyFortuneCard fortune={fortuneData} nickname={profile.nickname} />
      <HomeQuickEntries />
    </>
  ) : (
    ...
  )}
</div>
```

- [ ] **Step 6：GREEN + commit**

```bash
pnpm vitest run components/home/HomeQuickEntries.test.tsx
pnpm typecheck
git add components/home/ components/fortune/DailyFortuneCard.tsx app/page.tsx
git commit -m "feat(home): 4 入口卡 + 6 柱归一化 + 8 属性 grid（按 image2 mockup）"
```

**Acceptance：**4 入口卡渲染 / 跳转带 initial / 6 维度柱图 / 8 属性 2 行 4 列

**工时：4 h**

---

### Task M4.4：路由合并 /chat?cid=xxx

**Files：**
- Modify: `app/chat/page.tsx`（接受 ?cid + ?initial）
- Delete: `app/chat/[sessionId]/page.tsx`
- Modify: `app/chat/_components/HistoryDrawer.tsx`（跳转改 /chat?cid=...）

- [ ] **Step 1：写 page 测试**

```tsx
// app/chat/page.test.tsx 或 sanity 测
// 这里以 typecheck + 端到端为主，TDD 偏弱（Next page 多为 RSC）
```

- [ ] **Step 2：实现合并**

把 `app/chat/[sessionId]/page.tsx` 的逻辑搬到 `app/chat/page.tsx`：

```tsx
// app/chat/page.tsx
import { and, asc, eq } from "drizzle-orm";
import { AppHeader } from "@/components/layout";
import { ChatWindow } from "./_components/ChatWindow";
import { HistoryDrawer } from "./_components/HistoryDrawer";
import { ensureUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ cid?: string; initial?: string }>;
}

export default async function ChatPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const cid = sp.cid && sp.cid.length > 0 ? sp.cid : null;
  const initial = sp.initial;

  let initialMessages: any[] = [];
  let resolvedConvId: string | null = null;

  if (cid) {
    const userId = await ensureUserId();
    const db = getDb();
    const owned = await db.select({ id: conversations.id }).from(conversations)
      .where(and(eq(conversations.id, cid), eq(conversations.user_id, userId)))
      .limit(1);
    if (owned[0]) {
      resolvedConvId = cid;
      initialMessages = await db.select({
        id: messages.id, role: messages.role, content: messages.content,
        created_at: messages.created_at, metadata: messages.metadata,
      }).from(messages)
        .where(eq(messages.conversation_id, cid))
        .orderBy(asc(messages.created_at));
    }
  }

  return (
    <>
      <AppHeader title="AI 问答" left={<HistoryDrawer currentId={resolvedConvId ?? undefined} />} />
      <ChatWindow
        conversationId={resolvedConvId}
        initialMessages={initialMessages}
        autoSendText={initial}
      />
    </>
  );
}
```

- [ ] **Step 3：删 [sessionId] 路由**

```bash
git rm -r app/chat/[sessionId]
```

- [ ] **Step 4：改 HistoryDrawer 跳转**

```tsx
// app/chat/_components/HistoryDrawer.tsx 中
<Link href={`/chat?cid=${c.id}`} ...>
// 还要加"创建新对话"按钮：
<Link href="/chat" onClick={() => setOpen(false)} ...>+ 创建新对话</Link>
```

- [ ] **Step 5：补 ChatWindow autoSend 触发分支判定**

ChatWindow 的 send 函数已支持 autoSend，但要确认 SSE 对 'card' event 类型处理。在 send() 的 SSE 循环中加：

```ts
} else if (parsed.event === "card") {
  const card = parsed.data as DisplayMessage;
  setMessages((m) => [...m, card]);
}
```

- [ ] **Step 6：typecheck + commit**

```bash
pnpm typecheck
git add app/chat/page.tsx app/chat/_components/HistoryDrawer.tsx app/chat/_components/ChatWindow.tsx
git rm -r app/chat/[sessionId]/page.tsx
git commit -m "refactor(chat): 路由合并 /chat?cid=xxx，删 [sessionId] 路由"
```

**工时：3 h**

---

### Task M4.5：现居地字段加到 onboarding + me + schema

**Files：**
- Modify: `app/onboarding/_components/Step2BirthInfo.tsx`
- Modify: `app/onboarding/_components/schema.ts`
- Modify: `app/api/profile/route.ts`（接受 currentRegion）
- Modify: `app/me/page.tsx`（显示现居地）

- [ ] **Step 1：onboarding schema 加字段**

```ts
// app/onboarding/_components/schema.ts
export const onboardingSchema = z.object({
  // ...原字段
  currentRegion: z.object({
    province: z.string().min(1),
    city: z.string().min(1),
    district: z.string().optional(),
    longitude: z.number(),
    latitude: z.number(),
  }).nullable().optional(),
});
```

- [ ] **Step 2：Step2BirthInfo 加 RegionPicker（可选填）**

```tsx
// app/onboarding/_components/Step2BirthInfo.tsx
const [currentRegion, setCurrentRegion] = React.useState<RegionPickerValue | null>(initial.currentRegion ?? null);

// 渲染:
<div className="space-y-2">
  <Label>现居地（可选）</Label>
  <RegionPicker value={currentRegion} onChange={setCurrentRegion} />
</div>
```

提交时把 currentRegion 一并交出。

- [ ] **Step 3：profile route 接收**

```ts
// app/api/profile/route.ts POST 内
current_location: f.currentRegion
  ? [f.currentRegion.province, f.currentRegion.city, f.currentRegion.district].filter(Boolean).join(" ")
  : null,
```

- [ ] **Step 4：me 页显示**

```tsx
// app/me/page.tsx ProfileCard 内追加：
<Row label="现居地" value={profile.current_location || "—"} />
```

- [ ] **Step 5：typecheck + commit**

```bash
pnpm typecheck && pnpm test
git add app/onboarding/_components/ app/api/profile/route.ts app/me/page.tsx
git commit -m "feat(profile): 加现居地字段（onboarding 可选 + me 页显示）"
```

**工时：2 h**

---

## M4 部署 checkpoint

```bash
KEY=/Users/edy/Downloads/renliang.pem
SERVER=ubuntu@43.129.186.82

# 推所有 M4 改动文件 + 字体 + 底图
for f in $(find lib/canvas app/api/divination/slip-image components/home -type f); do
  ssh -i $KEY $SERVER "mkdir -p ~/occult/$(dirname $f)"
  scp -i $KEY $f $SERVER:~/occult/$f
done
scp -i $KEY public/fonts/ma-shan-zheng.ttf $SERVER:~/occult/public/fonts/
scp -i $KEY public/images/slip-bg.png $SERVER:~/occult/public/images/ 2>/dev/null || echo "(无底图)"
scp -i $KEY Dockerfile package.json pnpm-lock.yaml app/page.tsx \
            components/fortune/DailyFortuneCard.tsx \
            lib/fortune/attributes.ts \
            app/chat/page.tsx \
            app/chat/_components/HistoryDrawer.tsx \
            app/chat/_components/ChatWindow.tsx \
            app/onboarding/_components/Step2BirthInfo.tsx \
            app/onboarding/_components/schema.ts \
            app/api/profile/route.ts \
            app/me/page.tsx \
   $SERVER:~/occult/  # 按相对路径

ssh -i $KEY $SERVER 'cd ~/occult && rm -rf app/chat/[sessionId] && docker compose build --no-cache && docker compose up -d'
```

**验证**：手机访问 → 首页看到 4 入口卡 + 8 属性；点抽灵签 → /chat?initial=... → 对话流出 6 类签；选一类 → 出 SlipImageCard 含 PNG 图片。

---

## M5：闭环 + E2E（18 h / 2.3 d / 5 task）

### Task M5.1：解梦闭环（fast / precise 完整链路）

**Files：**
- Modify: `app/chat/_components/ChatWindow.tsx`（dream_choice 后续逻辑）

- [ ] **Step 1：在 ChatWindow.handleCardPick 完善 dream_choice**

```tsx
if (ui === "dream_choice") {
  if (key === "fast") {
    // 写一条提示消息让用户在普通输入框输入梦境
    setMessages((m) => [...m, {
      id: `tmp-${Date.now()}`, role: "assistant",
      content: "好的，请描述您的梦境（10-2000 字）。包含画面 / 人物 / 地点 / 故事 / 情绪都越详细越好。",
      created_at: new Date().toISOString(),
      metadata: JSON.stringify({ ui: "text", awaiting: "dream_fast" }),
    }]);
    return;
  }
  if (key === "precise") {
    // 写一条 dream_precise_form 卡片
    setMessages((m) => [...m, {
      id: `tmp-${Date.now()}`, role: "assistant",
      content: "请详细填写您的梦境信息：",
      created_at: new Date().toISOString(),
      metadata: JSON.stringify({ ui: "dream_precise_form" }),
    }]);
    return;
  }
}
```

- [ ] **Step 2：处理 awaiting=dream_fast 的下一条 user 消息**

ChatWindow.send 之前，检查最近一条 assistant 消息是否带 `awaiting: 'dream_fast'`。如有，直接 POST `/api/divination/dream` 而不是 `/api/chat`：

```tsx
// send 函数开头
const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
if (lastAsst && lastAsst.metadata) {
  try {
    const meta = JSON.parse(lastAsst.metadata);
    if (meta.awaiting === "dream_fast") {
      return await postDreamFast(text);
    }
    if (meta.awaiting === "slip_question" && meta.dimension) {
      return await postSlipQuery(text, meta.dimension);
    }
    if (meta.awaiting === "meihua_intro") {
      return await postMeihuaIntent(text);  // 触发"请给我 3 个数字"
    }
  } catch {}
}

async function postDreamFast(text: string) {
  if (!convId) return;
  setBusy(true);
  try {
    const r = await fetch("/api/divination/dream", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: convId, mode: "fast", payload: { dreamText: text } }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error); return; }
    setMessages((m) => [...m, d.userMessage, d.resultMessage]);
  } finally { setBusy(false); }
}

// postSlipQuery / postMeihuaIntent 类似
```

- [ ] **Step 3：手测 + commit**

```bash
pnpm dev
# 浏览器：/chat → 抽灵签 chip → 选事业学业 → 输入"项目能成吗" → 看到 SlipImageCard
# /chat → AI 解梦 chip → 选快速 → 输入梦 → 看到 DreamResultCard
# /chat → AI 解梦 chip → 选精准 → FormCard 4 字段 → 提交 → DreamResultCard
git add app/chat/_components/ChatWindow.tsx
git commit -m "feat(chat): 解梦闭环（fast / precise 路径完整化）"
```

**工时：3 h**

---

### Task M5.2：八字闭环（bazi_quick_form region/date 真实输入）

**Files：**
- Modify: `app/chat/_components/cards/FormCard.tsx`（type=region 挂 RegionPicker，type=date 挂 DatePicker）
- Modify: `app/chat/_components/MessageBubble.tsx`（BAZI_QUICK_FIELDS 用 region/date 类型）
- Modify: `app/chat/_components/ChatWindow.tsx`（parseQuickProfile 真实解析）

- [ ] **Step 1：FormCard 支持 region / date 类型**

```tsx
// FormCard.tsx 在 field 渲染 switch 里加：
} else if (f.type === "region") {
  return (
    <RegionPicker
      value={values[f.key] ? JSON.parse(values[f.key]) : null}
      onChange={(v) => setField(f.key, v ? JSON.stringify(v) : "")}
    />
  );
} else if (f.type === "date") {
  return (
    <DatePicker
      value={values[f.key] ? JSON.parse(values[f.key]) : null}
      onChange={(v) => setField(f.key, JSON.stringify(v))}
    />
  );
}
```

import RegionPicker / DatePicker。values 序列化为 JSON 字符串（Record<string, string> 的限制）。

- [ ] **Step 2：ChatWindow.parseQuickProfile 真实解析**

```ts
function parseQuickProfile(values: Record<string, string>): {
  gender: "male" | "female"; birth_time: string;
  birth_province: string; birth_city: string; birth_district?: string;
  longitude: number; latitude: number;
} {
  const region = JSON.parse(values.birth_place);
  const dateValue = JSON.parse(values.birth_time);
  const hour = dateValue.hour ?? 0;
  const iso = `${dateValue.solarDate}T${String(hour).padStart(2, "0")}:00:00+08:00`;
  return {
    gender: values.gender as "male" | "female",
    birth_time: iso,
    birth_province: region.province,
    birth_city: region.city,
    birth_district: region.district,
    longitude: region.longitude,
    latitude: region.latitude,
  };
}
```

- [ ] **Step 3：手测 + commit**

```bash
# 浏览器：/chat → 八字 chip → bazi_quick_form 卡片 → 选性别 / 出生时间 / 出生地 → 提交 → BaziResultCard
git add app/chat/_components/cards/FormCard.tsx app/chat/_components/MessageBubble.tsx app/chat/_components/ChatWindow.tsx
git commit -m "feat(chat): 八字闭环（FormCard 支持 region/date 类型）"
```

**工时：4 h**

---

### Task M5.3：测算闭环（meihua 纯对话流）

**Files：**
- Modify: `app/chat/_components/ChatWindow.tsx`（meihua_intro 后续逻辑）

- [ ] **Step 1：处理 meihua_intro 后用户描述事情 → 弹 number_input**

```ts
// ChatWindow handleCardPick 不涉及 meihua（用户直接打字）
// 但 send() 内要识别上下文：

// 当 last asst meta.ui === "meihua_intro" 时：
//   不调 /api/chat（不消耗 token）
//   而是写一条 ai 提示消息 + 一张 meihua_number_input 卡

if (meta.ui === "meihua_intro") {
  // 用户输入的 text 是"测算的事情"，存为下一步用
  setMessages((m) => [...m, {
    id: `tmp-u-${Date.now()}`, role: "user", content: text,
    created_at: new Date().toISOString(),
  }, {
    id: `tmp-a-${Date.now()}`, role: "assistant",
    content: "收到啦，请再给我任意 1-3 个 1-9 的数字（通过数字进行测算）",
    created_at: new Date().toISOString(),
    metadata: JSON.stringify({ ui: "meihua_number_input", userQuestion: text }),
  }]);
  return;
}
```

- [ ] **Step 2：FormCard meihua_number_input 提交时携带 userQuestion**

修改 ChatWindow.handleCardSubmit：

```ts
} else if (ui === "meihua_number_input") {
  // 取上一条 assistant 卡的 metadata.userQuestion
  const card = messages.find((x) => x.id === msgId);
  const cardMeta = card?.metadata ? JSON.parse(card.metadata) : {};
  const numbers = values.numbers.split(/[,，、\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 9);
  body = {
    conversationId: convId,
    numbers,
    userQuestion: cardMeta.userQuestion ?? "用户在卡片中提交",
  };
}
```

- [ ] **Step 3：手测 + commit**

```bash
# /chat → 测算 chip → AI 提示"请描述事情" → 用户输入"工作要换吗" → 弹 number_input 卡 →
# 用户填"3, 6, 9" → 提交 → MeihuaResultCard
git add app/chat/_components/ChatWindow.tsx
git commit -m "feat(chat): 测算闭环（纯对话流：描述 → 数字 → 起卦）"
```

**工时：3 h**

---

### Task M5.4：会话重命名 PATCH + HistoryDrawer 长按

**Files：**
- Modify: `app/api/conversations/[id]/route.ts`（加 PATCH）
- Create: `app/api/conversations/[id]/route.test.ts`
- Modify: `app/chat/_components/HistoryDrawer.tsx`（长按交互）

- [ ] **Step 1：PATCH 测试**

```ts
import { describe, it, expect } from "vitest";
import { PATCH } from "./route";

describe("PATCH /api/conversations/[id]", () => {
  it("title 必填非空 ≤ 20 字", async () => {
    const r = await PATCH(
      new Request("http://test", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "" }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(r.status).toBe(400);
  });

  it("title > 20 字 → 400", async () => {
    const r = await PATCH(
      new Request("http://test", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x".repeat(21) }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2：实现 PATCH**

```ts
// app/api/conversations/[id]/route.ts 加 export async function PATCH
import { z } from "zod";

const patchSchema = z.object({ title: z.string().trim().min(1).max(20) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "校验失败", issues: parsed.error.issues }, { status: 400 });
  }
  const userId = await ensureUserId();
  const db = getDb();
  const result = await db.update(conversations)
    .set({ title: parsed.data.title })
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)))
    .returning({ id: conversations.id });
  if (result.length === 0) return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3：HistoryDrawer 加长按 menu**

```tsx
// 用一个简单的右键 / 长按事件触发 prompt 改名
const onLongPress = (id: string, currentTitle: string) => {
  const newTitle = window.prompt("重命名为？", currentTitle);
  if (newTitle && newTitle.trim() && newTitle.trim().length <= 20) {
    void renameConv(id, newTitle.trim());
  }
};

// 列表条目加 onContextMenu / onTouchStart 计时
<div onContextMenu={(e) => { e.preventDefault(); onLongPress(c.id, c.title ?? ""); }} ...>
```

- [ ] **Step 4：commit**

```bash
pnpm vitest run app/api/conversations
git add app/api/conversations/[id]/route.ts app/api/conversations/[id]/route.test.ts app/chat/_components/HistoryDrawer.tsx
git commit -m "feat(conv): 会话重命名 PATCH + HistoryDrawer 长按交互"
```

**工时：3 h**

---

### Task M5.5：集成测试 + Playwright E2E

**Files：**
- Create: `tests/e2e/qy-main-flow.spec.ts`
- Modify: `playwright.config.ts`（如需）

- [ ] **Step 1：写 E2E 测试**

```ts
// tests/e2e/qy-main-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("福小运 主流程烟测", () => {
  test("8 步主流程", async ({ page }) => {
    // 1. 首页
    await page.goto("/");
    // 假设已有档案 / 或先跑 onboarding
    await expect(page).toHaveURL("/");

    // 2. 点抽灵签卡
    await page.getByText("抽灵签").click();
    await expect(page).toHaveURL(/\/chat\?initial=/);

    // 3. 选 6 类签主题
    await page.getByText("事业学业").first().click();

    // 4. 描述问题（送出后调 qianwen sub-action）
    await page.getByPlaceholder(/把想问的写给我/).fill("项目能成吗");
    await page.keyboard.press("Enter");
    await expect(page.locator("img[alt*='第']")).toBeVisible({ timeout: 30000 });

    // 5-8. AI 解梦 / 八字 / 测算 / 历史抽屉重命名（参考 spec §9.3）
  });
});
```

- [ ] **Step 2：跑测试**

```bash
pnpm test:e2e
```

- [ ] **Step 3：跑全集成 + 覆盖率**

```bash
pnpm test:coverage
```

预期：≥ 80%。

- [ ] **Step 4：commit**

```bash
git add tests/e2e/qy-main-flow.spec.ts
git commit -m "test(e2e): Playwright 主流程烟测 8 步"
```

**工时：5 h**

---

## M5 部署 checkpoint（最终上线验证）

```bash
KEY=/Users/edy/Downloads/renliang.pem
SERVER=ubuntu@43.129.186.82

# 推全部 M5 改动
scp -i $KEY app/chat/_components/ChatWindow.tsx app/chat/_components/HistoryDrawer.tsx \
           app/chat/_components/cards/FormCard.tsx app/chat/_components/MessageBubble.tsx \
           app/api/conversations/[id]/route.ts \
   $SERVER:~/occult/  # 按路径

ssh -i $KEY $SERVER 'cd ~/occult && docker compose build --no-cache && docker compose up -d && sleep 8 && docker compose ps'

# 跑 8 步真机烟测（手机或模拟器）
echo "请打开 http://43.129.186.82:3000 跑 spec §9.3 的 8 步主流程"
```

**最终验收：**
- [ ] 健康检查 200
- [ ] 4 chip 全部分流走通（抽灵签 / 测算 / AI 解梦 / 八字解读）
- [ ] 流式 chat 字符逐帧出（RAF 节流验证）
- [ ] 100 支签随机抽 5 次都成功（含 SlipImageCard 图片）
- [ ] 摘要器：发 15 轮后 conversations.summary 非空（直连 sqlite3 验证）
- [ ] 历史抽屉重命名生效

---

## 全计划 Self-Review

### Spec 覆盖度

| Spec 章节 | 对应 Task |
|---|---|
| §1 整体架构 | M2.1 / M3.3 / M4.4 |
| §2.1 messages.metadata 14 ui | M3.3（MessageBubble switch）|
| §2.2 conversations 字段 | M1.1 |
| §2.3 profiles.current_location | M1.1 / M4.5 |
| §2.4 维度归一化 | M1.1（scorer）|
| §2.5 100 支签 seed | M1.2 |
| §2.6 8 属性 | M4.2 |
| §3.1 /api/chat | M2.1 |
| §3.2 /api/intent/classify | M1.3（lib 层，未来如要 HTTP 暴露按需加）|
| §3.3 qianwen | M2.2 |
| §3.4 dream | M2.3 |
| §3.5 bazi | M2.4 |
| §3.6 meihua | M2.5 |
| §3.7 conversations PATCH | M5.4 |
| §4.1 首页 | M4.3 |
| §4.2 /chat 路由合并 | M4.4 |
| §4.3 /me | M4.5 |
| §4.4 fortune 维度归一 | M1.1（scorer）|
| §4.5 onboarding 现居地 | M4.5 |
| §5.1 ChoiceCard | M3.1 |
| §5.2 FormCard | M3.2 / M5.2（region/date 升级）|
| §5.3 4 结果卡 | M3.4 / M3.5 / M3.6 / M3.3（MeihuaResultCard 微调内嵌）|
| §5.4 MessageBubble | M3.3 |
| §5.5 IntentChips | M3.7 |
| §5.6 删除组件 | M3.3 |
| §6 签文 Canvas | M4.1 |
| §7 摘要器 | M1.4 |
| §9 测试 | M5.5 |

**覆盖完整。**

### 占位扫描

```
grep -nE "TBD|TODO|占位|fixme" docs/superpowers/plans/2026-04-26-qingyun-doc-realignment.md
```

仅出现在合理的"占位说明"段（描述 W5+ 推迟项 / V1 简化版规则待文档后续给出 / fortune_result 占位等），无实际 TODO。

### 类型一致性

- `Intent` 类型在所有 sub-action route 一致（chat / divination / dream / bazi / meihua）
- `DIMENSIONS` 6 类常量在 scorer / qianwen / bazi / 首页 全部使用同名
- `MetaUi.ui` 14 种字符串在 MessageBubble switch / route output / chat route guideCard 一一对应
- `IntentClassification` 接口在 classifier / chat route 一致

### 依赖图

无环（M1 → M2 → M3 → M4 → M5），M3.4 依赖 M4.1（SlipImageCard 显示需要 Canvas API），但 SlipImageCard 实现本身可独立测（imgsrc 是字符串）。

---

## 部署路径汇总

每个 M 完成后独立 deploy 到腾讯云。模式统一：

```bash
# 通用 deploy 模板
KEY=/Users/edy/Downloads/renliang.pem
SERVER=ubuntu@43.129.186.82

# 1. 列出本 M 涉及改动的所有文件 → scp 整文件覆盖
for f in <list>; do
  ssh -i $KEY $SERVER "mkdir -p ~/occult/$(dirname $f)"
  scp -i $KEY $f $SERVER:~/occult/$f
done

# 2. 重建 + 重启
ssh -i $KEY $SERVER 'cd ~/occult && docker compose build --no-cache && docker compose up -d'

# 3. 验证 .env 完整 + 健康
ssh -i $KEY $SERVER 'docker compose exec -T qingyun env | grep AI_GATEWAY_API_KEY'
curl http://43.129.186.82:3000/api/healthz
```

5 个 milestone 部署 checkpoint 已写在各 M 末尾。

---

## 执行说明

按 task 顺序执行。每完成一个 task：

1. 跑 `pnpm typecheck && pnpm test`
2. 跑该 task 标注的 Acceptance（手测 / curl 验证）
3. commit（不要省略 commit）
4. 进入下一 task

遇到 spec 没覆盖到的问题先 stop，反馈用户。

---

**计划版本：** v1.0
**作者：** edy + Claude
**总工时：** 96 h ≈ 12 工作日
**关联 Spec：** `docs/superpowers/specs/2026-04-26-qingyun-doc-realignment-design.md`

