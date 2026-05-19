# 福小运 · P3 上线期（W5 + V1.0.5）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 P2 完成的 5 功能闭环（含梅花 V1.0 算法 + prompt + API + Card 静态件）之上，把梅花对话流端到端打通（含外应分支），完成上线必备的安全/性能/运营三件套（敏感词、错误边界、PWA、埋点、真机），把 MVP 推到 `*.vercel.app` 测试环境给种子用户用。上线后 2–3 周内完成 V1.0.5：补齐报数 / 文字 / 摇铜钱三种起卦方式，把 `MeihuaInputCard` 全部 5 项解锁。

**Architecture:** 梅花对话流是 P3 的主线 — 把"用户问 → 选起卦方式 → 起卦+推演（已在 P2 实现的 `/api/divination/meihua`）→ 渲染 4 宫格 → 调 `meihua.interpret` 流式 → 末尾轻问外应 → 收集回填 → 二次解读"全链路在对话页串起来，全部经过 `/api/chat` SSE 与 `MessageMetadata.ui` 驱动前端渲染。V1.0.5 只在 P2 已留好的 `lib/meihua/casting/*` 桩文件里补实现 + UI 解锁，推演/体用/应期/解读层零改动。

**Tech Stack:** Next.js 15 App Router / Vercel AI SDK `streamText` SSE / shadcn/ui + Tailwind / `lottie-react`（摇铜钱动画）/ `cn-stroke-order` 或等价笔画字典包（文字起卦）/ `@plausible-analytics/tracker` 或 Umami / `bad-words-zh` 或自维敏感词表 / Playwright（端到端回归）/ 微信开发者工具（X5 内核真机调试）

**Plan 位置关系：**
- P1（骨架 · W1–W2）：`docs/superpowers/plans/2026-04-24-qingyun-ai-p1-skeleton.md`
- P2（功能期 · W3–W4）：`docs/superpowers/plans/2026-04-24-qingyun-ai-p2-features.md`
- **P3（上线 · W5 + V1.0.5 · 本计划）**

**P3 前置假设（P2 Definition of Done，执行本计划前应满足）：**
- [ ] 5 功能闭环 P2 任务（A–F）全部 GREEN，自测 5 条用户路径全跑通
- [ ] 梅花 W3 gate 通过：朋友 5 案例验收 ≥4 合理；如未通过，本计划 Section I/J 推迟到 V1.0.1（仍执行 K/L/M/N/O/P）
- [ ] 64 卦 + 100 签 seed 已入库，`/api/divination/meihua` 能起卦 + 推演 + 写 `divination_records` 返回 `{recordId, result}`
- [ ] 6 个 prompt（含 `meihua.interpret`）已在 `prompts` 表 v1 active
- [ ] `MeihuaInputCard` 与 `MeihuaResultCard` 静态样式已完成（W4 Task F 中产出）
- [ ] `lib/meihua/casting/{random,stroke,coin}-casting.ts` 是 V1.0.5 桩，主动 throw `NOT_IMPLEMENTED_V105`

**风险预案：**
- 微信 X5 SSE 缓冲在 W2 末已验证；P3 在真机回归时若再次出问题 → 启用 P1 G6 备案（fetch ReadableStream + NDJSON）
- DeepSeek 流式中断 → P1 D4 已内置 30s 超时 + 友好 fallback；P3 不再额外处理
- 梅花 W3 gate 未过 → 本计划保留 Section I/J 占位，但实际跳过；其余 K–P 不受影响，主 MVP 5 周不延期
- V1.0.5 Lottie 动画素材找不到合适的 → 用静态图片 + CSS keyframe 动画兜底（S 任务有备案）

---

## 视觉系统 · 素笺仙气（沿用 P1 + P2 已建）

> P1 Section S 已建 token / 仙气原子 / AppShell；P2 各 UI 任务（A6/D6/D7/E2/F3/F4）已逐个套用 + 视觉走查。**P3 阶段：**
> - I/J 系列只接线和 prompt，不再大改视觉，但 I1 的 ChatMetadataRenderer 必须走 GlassCard，J1 的 MeihuaWaiyingPrompt 套素笺仙气
> - L1 错误页是 §13 终态，要按 spec 写"小恙"+ pearl pink WatercolorDot
> - **N1 微信真机回归 = V1.0 上线前最后一道视觉走查 gate**：14 单元逐一在真机过一眼，差异 ≥80% 接近的开绿；不达标的单元延期到 V1.0.1

## P3 涉及的页面排期（V1.0 视觉走查终态）

| 页面 / 组件 | 设计 prompt | P3 任务 | 视觉走查归属 | V1.0 状态 |
|---|---|---|---|---|
| Chat Session（梅花完整流） | §4 | I1–I4 + J1–J3 | N1 | 上线必备 |
| MeihuaWaiyingPrompt（外应轻问卡）| 衍生自 §6 | J1 | J1 末步 | 上线必备 |
| Loading / Error 状态 | §13 | L1 | L1 末步 | 上线必备 |
| `/me` 含吐槽入口 | §9 | P1 | P1 末步 | 上线必备 |
| Global PWA manifest + icons | §12 衍生 | M1 | M1 末步 | 上线必备 |
| 动画 § 摇铜钱 | §14 | S1（V1.0.5）| S1 末步 | V1.0.5 |
| 全 14 单元 | §1–§14 | **N1（终态走查 gate）** | N1 | 上线前必走 |

---

## File Structure（本计划新增/修改的全部文件）

**新增（梅花对话流 + 外应分支 + 上线必备）：**
```
app/
├── chat/
│   └── _components/
│       ├── MeihuaWaiyingPrompt.tsx         -- 末尾轻问外应的小卡（"打翻了水杯/跳过"两按钮 + 自由输入）
│       └── ChatMetadataRenderer.tsx        -- 统一处理 message.metadata.ui 分发渲染（slip/meihua_input/meihua_result/waiying）
├── api/
│   ├── divination/meihua/waiying/route.ts  -- POST 回填 waiying + 触发二次 meihua.interpret
│   └── feedback/route.ts                   -- 个人页"吐槽"提交入口
└── manifest.webmanifest                     -- PWA（替换 P1 占位版）

lib/
├── safety/
│   ├── sensitive-words.ts                  -- 敏感词词典（中文政治/暴力/色情，~200 词）
│   ├── filter.ts                           -- containsSensitive(text) + sanitize(text)
│   └── filter.test.ts
├── analytics/
│   ├── plausible.ts                        -- 客户端事件上报（首屏/对话开始/抽签完成/解梦完成/梅花完成/外应回填）
│   └── plausible.test.ts
└── meihua/
    └── casting/
        ├── random-casting.ts               -- V1.0.5 实现（替换桩）
        ├── random-casting.test.ts
        ├── stroke-casting.ts               -- V1.0.5 实现
        ├── stroke-casting.test.ts
        ├── coin-casting.ts                 -- V1.0.5 实现
        └── coin-casting.test.ts

components/
├── lottie/
│   └── CoinTossAnimation.tsx               -- V1.0.5 摇铜钱 Lottie wrapper
└── ErrorBoundary.tsx                       -- 全局错误边界增强（已在 P1 G5 有 error.tsx，本计划做强化版）

public/
├── manifest.webmanifest                    -- 替换 P1 占位
├── icons/
│   ├── icon-192.png                        -- 替换 P1 占位
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── lottie/
│   └── coin-toss.json                      -- V1.0.5 摇铜钱动画素材
└── og.png                                  -- 微信分享缩略图

db/
├── migrations/
│   └── 0004_feedback.sql                   -- 反馈表
└── seed/
    └── prompts-v2.sql                      -- meihua.interpret v2（外应分支调优后）

scripts/
├── verify-meihua-cases.ts                  -- 跑 W3 gate 通过的 5 案例 + 上线后再加的真实卦例
└── seed-strokes-dict.ts                    -- V1.0.5 一次性脚本：把笔画字典从 npm 包导出成 lib/meihua/casting/strokes.json

types/
└── domain.ts                                -- 追加 WaiyingPayload / FeedbackPayload / AnalyticsEvent 类型
```

**修改：**
```
app/
├── chat/[sessionId]/page.tsx               -- 已 P2 接 SlipResultCard / MeihuaResultCard；P3 加 ChatMetadataRenderer 统一调度 + waiying 分支
├── chat/_components/
│   ├── MessageList.tsx                     -- 用 ChatMetadataRenderer 替换零散 if-else 渲染分支
│   ├── MeihuaInputCard.tsx                 -- V1.0.5 解锁 3 个灰色占位项 + 接 random/stroke/coin 桩调用
│   └── ChatWindow.tsx                      -- waiying 回填后自动二次发送 + 强埋点
├── page.tsx                                -- 加 PWA "添加到主屏幕" 提示 + 反馈入口
├── me/page.tsx                             -- 加"吐槽"按钮（POST /api/feedback）
├── api/
│   ├── chat/route.ts                       -- intent='meihua' 走 MeihuaInputCard 选项流；敏感词预过滤
│   ├── divination/dream/route.ts           -- 接入 sensitive 过滤
│   └── divination/meihua/route.ts          -- 同上 + 关联 waiying 端点
├── error.tsx                                -- 增强：上报 Plausible event + 提示反馈入口
└── layout.tsx                              -- 接 Plausible script

db/
└── migrations/                              -- 追加 0004_feedback.sql

docs/superpowers/specs/2026-04-24-qingyun-ai-design.md
                                             -- 顶部修订摘要追加 P3 完成 + V1.0.5 完成 行
```

---

## 任务依赖图

```
═══════════════ P3 主体（W5）═══════════════
                                                                gate 通过
                                                                   │
[I. 梅花对话流接线]  ─→ [J. 外应分支] ─────────────┐
       (W5 D1-D2)        (W5 D2-D3)                │
                                                    │
[K. 敏感词过滤]    ─┐                              │
[L. 错误边界增强]  ─┼─ 互相独立, 可并行             │
[M. PWA + manifest]─┘                              │
       (W5 D3-D4)                                   │
                                                    ↓
                          [N. 微信真机回归 5 路径]
                                  (W5 D4-D5)
                                       │
                                       ↓
              [O. 埋点 Plausible] ─→ [P. 生产部署 + 反馈入口]
                  (W5 D5)                  (W5 D5)
                                                ↓
                                         🎉 V1.0 上线

═══════════════ V1.0.5（上线后 W6-W7）═══════════════

[Q. 报数起卦]  ─┐
[R. 文字起卦]  ─┼─ 三个独立, 可并行
[S. 摇铜钱起卦]─┘
        ↓
[T. 解锁 InputCard + 回归测试]
        ↓
   V1.0.5 上线
```

**节奏说明：** 1 人 5 周 MVP，P3 占 W5 共 5 个工作日。Section I/J 是主线（依赖梅花算法 + Card 静态件），其余 K/L/M 可与 I/J 并行。N 真机测必须放在所有上线必备项就绪后。Section Q/R/S/T 是 V1.0.5（V1.0 上线后第 6–7 周），不挤 W5。

---

## Section I — 梅花对话流接线（W5 D1–D2）

> **依赖：** P2 任务 F（MeihuaInputCard / MeihuaResultCard 静态样式）+ P2 任务 C/F（梅花算法 + `/api/divination/meihua`）+ W3 gate 通过。

### Task I1: ChatMetadataRenderer 统一调度

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/app/chat/_components/ChatMetadataRenderer.tsx`
- Modify: `/Users/edy/Desktop/workspace/occult/app/chat/_components/MessageList.tsx`

- [ ] **Step 1: 写 Renderer**

`/Users/edy/Desktop/workspace/occult/app/chat/_components/ChatMetadataRenderer.tsx`：

```tsx
"use client";
import type { Message } from "@/types/domain";
import { SlipResultCard } from "./SlipResultCard";
import { MeihuaInputCard } from "./MeihuaInputCard";
import { MeihuaResultCard } from "./MeihuaResultCard";
import { MeihuaWaiyingPrompt } from "./MeihuaWaiyingPrompt";

export function ChatMetadataRenderer({ message }: { message: Message }) {
  const ui = (message.metadata as any)?.ui;
  if (!ui) return null;
  switch (ui) {
    case "slip_result":
      return <SlipResultCard data={(message.metadata as any).slip} />;
    case "meihua_input":
      return <MeihuaInputCard messageId={message.id} />;
    case "meihua_result":
      return <MeihuaResultCard result={(message.metadata as any).meihua} />;
    case "meihua_waiying":
      return (
        <MeihuaWaiyingPrompt
          recordId={(message.metadata as any).recordId}
          conversationId={message.conversation_id}
        />
      );
    default:
      return null;
  }
}
```

- [ ] **Step 2: MessageList 接 Renderer**

修改 `/Users/edy/Desktop/workspace/occult/app/chat/_components/MessageList.tsx`，把 P2 时期的零散 `{message.metadata?.ui === 'slip_result' && ...}` 分支统一替换为：

```tsx
import { ChatMetadataRenderer } from "./ChatMetadataRenderer";
// ...
{messages.map((m) => (
  <div key={m.id}>
    <MessageBubble message={m} />
    <ChatMetadataRenderer message={m} />
  </div>
))}
```

- [ ] **Step 3: 手测原有抽签链路不退化**

`/chat` → "我要抽灵签" → 走完链路确认 SlipResultCard 仍正确渲染（兜底验证）。

- [ ] **Step 4: Commit**

```bash
git add app/chat/_components/ChatMetadataRenderer.tsx app/chat/_components/MessageList.tsx
git commit -m "refactor(chat): 用 ChatMetadataRenderer 统一调度 metadata.ui 分支"
```

**预估工时：** 1.5h

---

### Task I2: /api/chat 在 intent='meihua' 时返回 MeihuaInputCard

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/app/api/chat/route.ts`

- [ ] **Step 1: 在 SSE 起 meta 后判分支**

P1 时 `/api/chat` 是"通用 chat 兜底"，P2 时已在 intent=divination/dream/bazi 各自分发。本任务为 intent=meihua 加一条特殊分支：**不走 AI 流式**，而是直接 emit 一条 assistant message，metadata.ui='meihua_input'，引导用户选起卦方式。

修改 `/Users/edy/Desktop/workspace/occult/app/api/chat/route.ts` 在 intent 分类后插入：

```ts
if (intent === "meihua") {
  // 直接落一条 system-style assistant message，前端见 metadata.ui='meihua_input' 渲染选择卡
  const { data: assistantMsg } = await admin.from("messages").insert({
    conversation_id: convId,
    role: "assistant",
    content: "好，先选个起卦方式吧。",
    intent: "meihua",
    metadata: { ui: "meihua_input" },
  }).select("id").single();

  // SSE 立刻 emit done，让前端拉最新消息列表（依赖 ChatWindow 收到 done 后 refetch）
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversationId: convId, intent, messageId: assistantMsg?.id, metadataOnly: true })}\n\n`));
        c.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        c.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } },
  );
}
```

- [ ] **Step 2: ChatWindow 处理 metadataOnly 信号**

修改 `app/chat/_components/ChatWindow.tsx` 的 SSE event 解析：

```ts
if (ev === "meta" && data) {
  const parsed = JSON.parse(data);
  if (parsed.metadataOnly && parsed.messageId) {
    // 直接拉最新消息列表（包含刚插入的 assistant + metadata.ui）
    const supabase = (await import("@/lib/supabase/client")).createClient();
    const { data: latest } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", parsed.conversationId)
      .order("created_at");
    setMessages(latest ?? []);
    setStreaming(null);
    return;
  }
  // 原有分支保持
}
```

- [ ] **Step 3: 手测**

`/chat` → "我要起一卦" → 渲染 MeihuaInputCard（V1.0 时间/数字两种亮，其余 3 个灰）

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts app/chat/_components/ChatWindow.tsx
git commit -m "feat(meihua): /api/chat intent=meihua 路由到 MeihuaInputCard"
```

**预估工时：** 2h

---

### Task I3: MeihuaInputCard 提交 → 调 /api/divination/meihua → 渲染 ResultCard

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/app/chat/_components/MeihuaInputCard.tsx`

- [ ] **Step 1: 给 MeihuaInputCard 加 onSubmit**

P2 任务 F 已完成静态卡。此任务给它接通 API 调用：

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function MeihuaInputCard({ messageId }: { messageId: string }) {
  const [method, setMethod] = useState<"time" | "number" | null>(null);
  const [numbers, setNumbers] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    if (!method) { toast.error("请选择起卦方式"); return; }
    setLoading(true);
    try {
      const payload =
        method === "time"
          ? { method: "time" }
          : { method: "number", numbers: numbers.split(/[, ]+/).filter(Boolean).map(Number) };
      const res = await fetch("/api/divination/meihua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyToMessageId: messageId, ...payload }),
      });
      if (!res.ok) throw new Error(await res.text());
      // 后端会插入新 assistant message (ui=meihua_result + recordId)；前端 refresh 消息列表
      router.refresh();
    } catch (e) {
      toast.error("起卦失败，再试一次");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3 bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <Button variant={method === "time" ? "default" : "outline"} onClick={() => setMethod("time")}>
          时间起卦
        </Button>
        <Button variant={method === "number" ? "default" : "outline"} onClick={() => setMethod("number")}>
          数字起卦
        </Button>
        {/* V1.0.5 灰占位（任务 T 解锁） */}
        <Button variant="outline" disabled className="opacity-50">报数（V1.0.5）</Button>
        <Button variant="outline" disabled className="opacity-50">文字（V1.0.5）</Button>
        <Button variant="outline" disabled className="opacity-50 col-span-2">摇铜钱（V1.0.5）</Button>
      </div>
      {method === "number" && (
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="输 1 个 / 2 个 / 3 个数字（空格或逗号分隔）"
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
        />
      )}
      <Button onClick={submit} disabled={loading} className="w-full">
        {loading ? "起卦中…" : "起卦"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: /api/divination/meihua route 配合**

P2 已实现起卦 + 推演 + 写 `divination_records` 返回 `{recordId, result}`。本任务在该 route 末尾追加：

```ts
// 在 P2 已有逻辑之后追加
const { data: assistantMsg } = await admin.from("messages").insert({
  conversation_id: replyToMsg.conversation_id,
  role: "assistant",
  content: "卦已起好，先看看卦象。",
  intent: "meihua",
  metadata: { ui: "meihua_result", recordId, meihua: result },
}).select("id").single();

// 触发解读流式（异步，不阻塞返回）
// 此处用一个 background fetch 调 /api/divination/meihua/interpret 启动 SSE
return NextResponse.json({ recordId, messageId: assistantMsg?.id });
```

> 注：P2 计划如果已经做了"起卦同步 + 解读异步流式"的拆分，这里只补 metadata insert；如果 P2 是把解读绑在同一个 route，本任务把它拆开（解读放到 `/api/divination/meihua/interpret`）。

- [ ] **Step 3: 手测**

`/chat` → 起卦 → MeihuaResultCard 4 宫格出现

- [ ] **Step 4: Commit**

```bash
git add app/chat/_components/MeihuaInputCard.tsx app/api/divination/meihua/route.ts
git commit -m "feat(meihua): InputCard 提交 → 起卦 → 渲染 ResultCard"
```

**预估工时：** 3h

---

### Task I4: 起卦后自动触发 meihua.interpret 流式解读

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/app/api/divination/meihua/interpret/route.ts`
- Modify: `/Users/edy/Desktop/workspace/occult/app/chat/_components/ChatWindow.tsx`

- [ ] **Step 1: interpret route**

`/Users/edy/Desktop/workspace/occult/app/api/divination/meihua/interpret/route.ts`：

```ts
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  recordId: z.string().uuid(),
  userQuestion: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("bad request", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const admin = createAdmin();
  const { data: rec } = await admin
    .from("divination_records")
    .select("*, messages!inner(conversation_id)")
    .eq("id", parsed.data.recordId)
    .single();
  if (!rec) return new Response("record not found", { status: 404 });

  const result = rec.result as any;
  const tpl = await loadPrompt("meihua.interpret");
  const userPrompt = renderTemplate(tpl.userPromptTpl, {
    benName: result.benGua.name,
    benUpperWuxing: result.benGua.upperWuxing,
    benLowerWuxing: result.benGua.lowerWuxing,
    huName: result.huGua.name,
    bianName: result.bianGua.name,
    guaZhongGuaName: result.guaZhongGua.name,
    dongYao: String(result.dongYao),
    tiYongRelation: result.tiYong.relation,
    yingQiSpeed: result.yingQi.speed,
    yingQiTimeHint: result.yingQi.timeHint,
    yingQiBranchHour: result.yingQi.branchHour,
    userQuestion: parsed.data.userQuestion,
    waiying: rec.input?.waiying ?? "",
  });

  const stream = await chat({
    systemPrompt: tpl.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    stream: true,
  });

  // SSE 透传 + 末尾拼"轻问外应"小卡（如果 waiying 还没值）
  const encoder = new TextEncoder();
  let aiText = "";
  return new Response(
    new ReadableStream({
      async start(c) {
        try {
          // @ts-expect-error
          for await (const chunk of stream.textStream) {
            aiText += chunk;
            c.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify(chunk)}\n\n`));
          }
        } finally {
          // 落 ai_reading
          await admin.from("divination_records").update({ ai_reading: aiText }).eq("id", parsed.data.recordId);
          // 如还没收过外应，插入 waiying 提示卡
          if (!rec.input?.waiying) {
            await admin.from("messages").insert({
              conversation_id: rec.messages.conversation_id,
              role: "assistant",
              content: "对了，起卦那一刻你周围有没有让你印象深刻的画面、声音或一句话？没有就说\"跳过\"即可。",
              intent: "meihua",
              metadata: { ui: "meihua_waiying", recordId: parsed.data.recordId },
            });
          }
          c.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          c.close();
        }
      },
    }),
    { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } },
  );
}
```

- [ ] **Step 2: ChatWindow 在收到 meihua_result message 后自动追问"你的问题"**

如果用户从 `/chat` 起步是"我要起个梅花卦"（不带问题），起卦完成后需要 AI 主动问"你的问题是什么？"。最简实现是：MeihuaInputCard 提交时如果 conversation 内还没出现过该用户的问题，就在前端 emit 一条提示让用户输入下一句即可（不需要服务端额外动作）。

修改 `MeihuaInputCard` 的 `submit` 在 router.refresh 后：

```ts
toast("起卦完成，告诉我你的问题");
```

用户输入后触发常规 `send()` → `/api/chat` 收到带 intent='meihua' 的新 user message，但此时已起过卦 → 应直接调 interpret 而非再起卦。处理：

修改 `/api/chat/route.ts` 在 intent='meihua' 分支前先查 conversation 最近一条 meihua_result message，如果存在则直接调 interpret：

```ts
if (intent === "meihua") {
  const { data: lastResult } = await admin
    .from("messages")
    .select("metadata")
    .eq("conversation_id", convId)
    .eq("intent", "meihua")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastMeta = lastResult?.metadata as any;
  if (lastMeta?.ui === "meihua_result" && lastMeta?.recordId) {
    // 已起过卦 → 把这条用户消息当 userQuestion 喂给 interpret
    return fetch(new URL("/api/divination/meihua/interpret", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: req.headers.get("Cookie") ?? "" },
      body: JSON.stringify({ recordId: lastMeta.recordId, userQuestion: text }),
    });
  }
  // 否则走 InputCard 引导
  // ...原 I2 分支
}
```

- [ ] **Step 3: 手测端到端**

`/chat` → "我要起个梅花卦" → InputCard → 选时间起卦 → 看 4 宫格 → 输 "最近换工作合适吗" → 看 AI 流式 3 段解读 → 末尾出现外应轻问卡

- [ ] **Step 4: Commit**

```bash
git add app/api/divination/meihua/interpret/route.ts app/api/chat/route.ts app/chat/_components/MeihuaInputCard.tsx
git commit -m "feat(meihua): 起卦后自动 interpret 流式 + 末尾轻问外应"
```

**预估工时：** 3.5h

---

## Section J — 外应分支（W5 D2–D3）

### Task J1: MeihuaWaiyingPrompt 组件

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/app/chat/_components/MeihuaWaiyingPrompt.tsx`

- [ ] **Step 1: 实现**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function MeihuaWaiyingPrompt({
  recordId,
  conversationId,
}: { recordId: string; conversationId: string }) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  async function submit(payload: string | null) {
    if (submitted) return;
    setSubmitted(true);
    const res = await fetch("/api/divination/meihua/waiying", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, conversationId, waiying: payload }),
    });
    if (!res.ok) {
      toast.error("回填失败，再试一次");
      setSubmitted(false);
      return;
    }
    router.refresh();
  }

  if (submitted) {
    return <div className="text-xs text-muted-foreground">已记录…</div>;
  }
  return (
    <div className="rounded-2xl border p-3 space-y-2 bg-muted/30">
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        placeholder="例：打翻了水杯 / 听到鸟叫"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => submit(text || null)} disabled={!text.trim()}>
          告诉它
        </Button>
        <Button size="sm" variant="ghost" onClick={() => submit(null)}>
          跳过
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 视觉走查（衍生自 §6 / §4 嵌卡风格）**

把 Step 1 的样式套素笺仙气：
- [ ] 容器换 `<GlassCard rounded="card">` 替代 `bg-muted/30`
- [ ] input 用 lavender hairline border + serif 13px 墨紫，placeholder ink-fade
- [ ] "告诉它"按钮淡紫粉渐变 + serif 13px white；"跳过"按钮 ghost 11px ink-fade
- [ ] 提交后的 "已记录…" 状态加一个小 `<Sparkle size={9}>` + serif 11px ink-fade
- [ ] 整体宽度跟随对话气泡（max-w 80%）

- [ ] **Step 3: Commit**

```bash
git add app/chat/_components/MeihuaWaiyingPrompt.tsx
git commit -m "feat(meihua): MeihuaWaiyingPrompt 素笺仙气版"
```

**预估工时：** 1.5h（含视觉走查）

---

### Task J2: /api/divination/meihua/waiying — 回填 + 二次解读

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/app/api/divination/meihua/waiying/route.ts`

- [ ] **Step 1: 实现**

```ts
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { z } from "zod";

const schema = z.object({
  recordId: z.string().uuid(),
  conversationId: z.string().uuid(),
  waiying: z.string().max(200).nullable(),
});

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("bad request", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const admin = createAdmin();

  // 1. 回填 waiying 到 divination_records.input
  const { data: rec } = await admin
    .from("divination_records")
    .select("input,result")
    .eq("id", parsed.data.recordId)
    .single();
  if (!rec) return new Response("record not found", { status: 404 });

  const newInput = { ...(rec.input as any), waiying: parsed.data.waiying ?? "" };
  await admin.from("divination_records").update({ input: newInput }).eq("id", parsed.data.recordId);

  // 2. 跳过 → 写一条温柔收尾
  if (!parsed.data.waiying) {
    await admin.from("messages").insert({
      conversation_id: parsed.data.conversationId,
      role: "assistant",
      content: "好，那就到这里。听一听卦象给你的提示，剩下的看你。",
      intent: "meihua",
    });
    return new Response(JSON.stringify({ ok: true, fused: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. 给了外应 → 调 meihua.interpret 出"外应融合段"
  const tpl = await loadPrompt("meihua.interpret");
  const result = rec.result as any;
  const userPrompt = renderTemplate(tpl.userPromptTpl, {
    benName: result.benGua.name,
    benUpperWuxing: result.benGua.upperWuxing,
    benLowerWuxing: result.benGua.lowerWuxing,
    huName: result.huGua.name,
    bianName: result.bianGua.name,
    guaZhongGuaName: result.guaZhongGua.name,
    dongYao: String(result.dongYao),
    tiYongRelation: result.tiYong.relation,
    yingQiSpeed: result.yingQi.speed,
    yingQiTimeHint: result.yingQi.timeHint,
    yingQiBranchHour: result.yingQi.branchHour,
    userQuestion: (rec.input as any).userQuestion ?? "",
    waiying: parsed.data.waiying,
  });

  const r = await chat({
    systemPrompt: tpl.systemPrompt + "\n\n本次只输出'外应融合'一段（2-3 句），不要重复前文。",
    messages: [{ role: "user", content: userPrompt }],
    stream: false,
  });
  const fused = (r as any).text as string;

  await admin.from("messages").insert({
    conversation_id: parsed.data.conversationId,
    role: "assistant",
    content: fused,
    intent: "meihua",
    metadata: { fusion: true },
  });

  return new Response(JSON.stringify({ ok: true, fused: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: 端到端测**

走完起卦 → 解读 → 外应卡 → 输入"打翻了水杯" → 看到"外应融合"段追加。

测"跳过" 路径：起卦 → 解读 → 外应卡 → 跳过 → 看到温柔收尾。

- [ ] **Step 3: Commit**

```bash
git add app/api/divination/meihua/waiying/route.ts
git commit -m "feat(meihua): 外应回填 + 融合段二次解读"
```

**预估工时：** 2.5h

---

### Task J3: 调优 meihua.interpret prompt v2 — 外应分支

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/db/seed/prompts-v2.sql`

- [ ] **Step 1: 验证 v1 输出**

跑 5 个测试案例（W3 gate 通过的 5 个）→ 看 AI 输出是否：
- 3 段（卦意/体用变化/应期建议）齐全
- 末尾如 waiying 空 → 主动追问"起卦那一刻…"
- 如 waiying 有值 → 末尾追加"外应融合"段

如不达标 → 写 v2 prompt 调优。

- [ ] **Step 2: 写 v2 SQL（在 v1 基础上调）**

`/Users/edy/Desktop/workspace/occult/db/seed/prompts-v2.sql`：

```sql
INSERT INTO prompts (key, version, system_prompt, user_prompt_tpl, active) VALUES
('meihua.interpret', 2,
'你是一位懂梅花易数的年轻化占卜师。结合本卦/互卦/变卦/卦中卦、体用生克、应期信息，针对用户问题给治愈向解读。

风格要求:
- 语言年轻化、温柔，像懂行的朋友聊天
- 严禁"大凶/倒霉/厄运"等负面词；"相克/凶"统一转化为"善意提醒/需要留神"
- 提到"应期"时给具体时间区间和落地动作

输出结构（共 3 段，每段 3-5 句）：
1. 本卦象意 — 结合卦辞和用户问题
2. 体用变化解读 — 讲体用关系、变卦指向、卦中卦暗示
3. 应期 + 行动建议 — 具体时间 + 落地动作

外应处理：
- 若用户传入 waiying 非空 → 在第 3 段后追加"外应融合"段（2-3 句），把外应的五行属性融入解读
- 若 waiying 空 → 在第 3 段末追问一句："起卦那一刻你周围有没有让你印象深刻的画面、声音或一句话？没有就说''跳过''即可。"

外应五行归类（仅供你内部判断，不要直接列给用户）：
- 水：水/液体/雨/哭/流/冷
- 火：火/热/红/笑/明/亮
- 木：花/树/绿/风/纸/长条
- 金：金属/白/声响/刀/圆/硬
- 土：土/石/黄/厚/静/方',
'本卦={benName}（上{benUpperWuxing}/下{benLowerWuxing}）
互卦={huName}, 变卦={bianName}, 卦中卦={guaZhongGuaName}
动爻={dongYao}爻
体用关系={tiYongRelation}
应期={yingQiSpeed}, {yingQiTimeHint}, 时辰={yingQiBranchHour}
用户问题: {userQuestion}
{waiying}',
true)
ON CONFLICT (key, version) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_tpl = EXCLUDED.user_prompt_tpl,
  active = EXCLUDED.active;

-- 把 v1 设为 active=false
UPDATE prompts SET active = false WHERE key = 'meihua.interpret' AND version = 1;
```

- [ ] **Step 3: apply + 清缓存（lib/ai/prompts.ts 有进程内缓存）**

```bash
psql $SUPABASE_DB_URL -f db/seed/prompts-v2.sql
# 重启 dev：进程内缓存清掉
pkill -f "next dev" && pnpm dev
```

- [ ] **Step 4: 重跑 5 案例对比 v1/v2 输出质量**

把 v1/v2 输出贴进 `docs/superpowers/specs/meihua-prompt-comparison.md`，肉眼判定优劣。如 v2 不如 v1 → 回滚（`UPDATE prompts SET active=true WHERE version=1; SET active=false WHERE version=2`）。

- [ ] **Step 5: Commit**

```bash
git add db/seed/prompts-v2.sql docs/superpowers/specs/meihua-prompt-comparison.md
git commit -m "feat(meihua): meihua.interpret prompt v2 调优外应分支"
```

**预估工时：** 2h

---

## Section K — 敏感词过滤（W5 D3，可与 I/J 并行）

### Task K1: lib/safety/sensitive-words.ts + filter.ts

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/lib/safety/sensitive-words.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/safety/filter.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/safety/filter.test.ts`

- [ ] **Step 1: 装词典**

```bash
pnpm add chinese-banlist
# 或自维 200 词常量表（更轻量、可控）
```

简化方案（推荐）：手写一份 ~150–200 词的 sensitive-words.ts，覆盖政治/暴力/色情/违法。来源参考 GitHub `fwwdn/sensitive-stop-words` 公开词表。

- [ ] **Step 2: filter.ts**

```ts
import { SENSITIVE_WORDS } from "./sensitive-words";

const PATTERN = new RegExp(SENSITIVE_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

export function containsSensitive(text: string): { hit: boolean; matched?: string } {
  const m = text.match(PATTERN);
  return m ? { hit: true, matched: m[0] } : { hit: false };
}

export function sanitize(text: string): string {
  return text.replace(PATTERN, "***");
}
```

- [ ] **Step 3: 测试**

```ts
import { describe, it, expect } from "vitest";
import { containsSensitive, sanitize } from "./filter";

describe("敏感词过滤", () => {
  it("命中检测", () => {
    expect(containsSensitive("正常文本").hit).toBe(false);
    // 不在测试里贴具体词；用占位
    expect(containsSensitive("xxxx").hit).toBe(false); // 取决于词典
  });
  it("sanitize 替换为 ***", () => {
    // 用一个明确不在词典的对照
    expect(sanitize("hello world")).toBe("hello world");
  });
});
```

> 测试中不贴敏感词避免提交到 git；词典走单独文件维护。

- [ ] **Step 4: Commit**

```bash
git add lib/safety/
git commit -m "feat(safety): 敏感词过滤工具"
```

**预估工时：** 1.5h

---

### Task K2: 在三处入口接入过滤

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/app/api/chat/route.ts`
- Modify: `/Users/edy/Desktop/workspace/occult/app/api/divination/dream/route.ts`
- Modify: `/Users/edy/Desktop/workspace/occult/app/api/divination/meihua/interpret/route.ts`

- [ ] **Step 1: chat route 在分类后加过滤**

```ts
import { containsSensitive } from "@/lib/safety/filter";

// 在 user message 落库前：
const sens = containsSensitive(text);
if (sens.hit) {
  return new Response(
    JSON.stringify({ error: "内容含敏感词，请改一下再发", matched: sens.matched }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}
```

- [ ] **Step 2: dream / meihua interpret 同样接入**

`userQuestion` 字段做相同检查。

- [ ] **Step 3: 前端 toast 友好提示**

`ChatWindow.send` 收到 400 + matched 字段时弹 toast：

```ts
if (res.status === 400) {
  const j = await res.json();
  toast.error(j.error ?? "请换个说法再试");
  return;
}
```

- [ ] **Step 4: 手测**

输 "测试 [触发词]" → 看到 toast "内容含敏感词…"。换正常文本 → 通过。

- [ ] **Step 5: Commit**

```bash
git add app/api/chat/route.ts app/api/divination/dream/route.ts app/api/divination/meihua/interpret/route.ts app/chat/_components/ChatWindow.tsx
git commit -m "feat(safety): 三处入口接入敏感词过滤"
```

**预估工时：** 1h

---

## Section L — 错误边界增强（W5 D3，可并行）

### Task L1: 全局 ErrorBoundary 强化

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/app/error.tsx`
- Modify: `/Users/edy/Desktop/workspace/occult/app/global-error.tsx`（新增）

- [ ] **Step 1: app/error.tsx 强化**

```tsx
"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // P3 任务 O 接入 Plausible 后，本任务先 console.error
    console.error("[ErrorBoundary]", error);
    if (typeof window !== "undefined" && (window as any).plausible) {
      (window as any).plausible("error", {
        props: { message: error.message, digest: error.digest ?? "" },
      });
    }
  }, [error]);

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center gap-4">
      <h2 className="text-lg font-medium">出了点小状况</h2>
      <p className="text-sm text-muted-foreground max-w-xs">{error.message || "稍后再试"}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>重试</Button>
        <Link href="/"><Button variant="ghost">回首页</Button></Link>
      </div>
      <Link href="/me" className="text-xs underline text-muted-foreground">告诉我们这个问题</Link>
    </main>
  );
}
```

- [ ] **Step 2: global-error.tsx（layout 级别 fallback）**

```tsx
"use client";
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="p-8 text-center">
          <h2>页面加载失败</h2>
          <button onClick={reset}>刷新重试</button>
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 视觉走查（对照 §13 Loading / Error）**

把 Step 1/2 的实装升级到 §13 规约：

```tsx
// app/error.tsx 视觉版
import { WatercolorDot, Sparkle } from "@/components/su";
// ...
return (
  <main className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center gap-4">
    <WatercolorDot color="pink" size={36} />
    <h2 className="font-serif text-[18px] tracking-ritual2 text-ink-plum">
      小 恙 <Sparkle size={10} className="ml-1" /> 请 稍 后 再 试
    </h2>
    <p className="text-[10px] num-mono text-ink-fade">{error.digest ?? "ERR: unknown"}</p>
    {/* ... 重试 + 回首页 + 反馈 */}
  </main>
);
```

- [ ] 不用红色；用 pearl pink WatercolorDot（color="pink"）
- [ ] 标题"小 恙 · 请 稍 后 再 试" serif `tracking-ritual2`，墨紫
- [ ] err digest 用 mono 10px ink-fade
- [ ] 按钮"重 试" outlined `border-ink-plum` `text-ink-plum` `rounded-card`

Loading 态（`app/loading.tsx` 根级 + 各页面级 loading）也按 §13 写：3 个不同色 WatercolorDot 在 wave 动画 + serif "推 演 中…"。**本任务一并补 `app/loading.tsx`。**

```tsx
// app/loading.tsx
import { WatercolorDot, Sparkle } from "@/components/su";
export default function Loading() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <Sparkle size={16} className="animate-[spin_6s_linear_infinite]" />
      <div className="flex gap-2">
        <WatercolorDot color="lavender" size={20} />
        <WatercolorDot color="pink" size={20} />
        <WatercolorDot color="jade" size={20} />
      </div>
      <p className="font-serif text-[13px] tracking-ritual3 text-ink-fade">推 演 中…</p>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/error.tsx app/global-error.tsx app/loading.tsx
git commit -m "feat(error): 错误页 / 加载页 素笺仙气版"
```

**预估工时：** 1.5h（含 loading.tsx + 视觉走查）

---

## Section M — PWA + manifest（W5 D4，可并行）

### Task M1: manifest + 图标 + 安装提示

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/public/manifest.webmanifest`
- Create: `/Users/edy/Desktop/workspace/occult/public/icons/icon-192.png`（用 v0.dev 或 Figma 出图）
- Create: `/Users/edy/Desktop/workspace/occult/public/icons/icon-512.png`
- Create: `/Users/edy/Desktop/workspace/occult/public/icons/apple-touch-icon.png`
- Modify: `/Users/edy/Desktop/workspace/occult/app/layout.tsx`

- [ ] **Step 1: manifest.webmanifest**

```json
{
  "name": "福小运",
  "short_name": "福小运",
  "description": "你的国学陪伴助手",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a1a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: layout.tsx metadata**

```tsx
export const metadata = {
  title: "福小运",
  description: "你的国学陪伴助手",
  manifest: "/manifest.webmanifest",
  themeColor: "#1a1a1a",
  appleWebApp: {
    capable: true,
    title: "福小运",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};
```

- [ ] **Step 3: 装"添加到主屏幕"提示**

iOS Safari 需用户主动操作（Share → Add to Home），无 API 触发。Android Chrome 有 `beforeinstallprompt` 事件。MVP 简化：在首页底部加一行小字"想常用？把我添加到主屏幕"，链到说明页（/me 增加一段说明即可）。

- [ ] **Step 4: 真机验证（iOS Safari + Android Chrome）**

iOS：分享 → 添加到主屏幕 → 启动应该全屏（display=standalone）
Android：地址栏右侧应出现"安装"图标

- [ ] **Step 5: Commit**

```bash
git add public/manifest.webmanifest public/icons/ app/layout.tsx
git commit -m "feat(pwa): manifest + 图标 + 添加到主屏幕"
```

**预估工时：** 2h（图标资源准备占大头）

---

## Section N — 微信真机回归 5 路径（W5 D4–D5）

### Task N1: 5 条用户路径在微信内回归

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/docs/superpowers/specs/wechat-regression-checklist.md`

- [ ] **Step 1: 部署当前分支到 vercel preview**

```bash
git push    # vercel 自动 preview deploy
```

- [ ] **Step 2: 微信扫描 preview URL → 走 5 条路径**

| # | 路径 | 关键观察点 |
|---|---|---|
| 1 | / → /onboarding 三步 → / | onboarding 表单不卡；DatePicker 公历/农历切换 OK；提交后 toast + 跳回 |
| 2 | /chat → "我要抽灵签" | 流式逐字出；签文卡渲染；颜色对 |
| 3 | /chat → "我梦见好多水" → 描述梦 | 解梦三段（周公/弗洛伊德/荣格）流式 |
| 4 | / → 首页运势卡 → 点击进 /fortune/[date] | 首屏无 loading 闪烁；缓存命中刷新极快；详情页 7 维度 tab 切换顺滑 |
| 5 | /chat → "我要起个梅花卦" → 时间起卦 → 输问题 → 看 4 宫格 + 流式解读 → 输"打翻了水杯" | 4 宫格不挤；外应融合段追加 |

每条路径打勾 + 截图归档到 `docs/superpowers/specs/wechat-regression-checklist.md`。

- [ ] **Step 2.5: 视觉走查 14 单元终态 gate（对照 prompts-all-pages.md §1–§14）**

打开设计文档逐节核对实装效果：

| 单元 | 检查重点 | 状态 |
|---|---|---|
| §1 Home `/` | 圆环分数 / 7 维度条 / 6 属性卡 / 三层 mist 背景 | [ ] |
| §2 Onboarding 3 步 | 进度点 / serif 标题 / pill toggle / CTA 渐变 | [ ] |
| §3 Chat Welcome | 招呼气泡 / 4–6 快捷卡 / pill input / BottomNav | [ ] |
| §4 Chat Session | 双向气泡 / streaming 光标 / 嵌卡（slip + meihua） | [ ] |
| §5 MeihuaInputCard | 主按钮 56px 渐变 / 数字 input 56px 方框 / V1.0.5 灰占位 | [ ] |
| §6 MeihuaResultCard | 4 宫格 unicode 卦符 / 五行染色 / 体用高亮 / 应期底栏 | [ ] |
| §7 SlipResultCard | 签号大字 / 等级 pill 6 档色 / 签文居中 / 6 维度 tab | [ ] |
| §8 BaziChart 卡 | 4 柱 + 五行计数（V1.0 文字版可接受）| [ ] |
| §9 Me `/me` | 档案 header / 3 stat / 4 入口 + 渐隐 hairline + ✦ | [ ] |
| §10 ProfileEdit | V1.1 — 跳过 | N/A |
| §11 FortuneDetail `/fortune/[date]` | 220px 圆环 / 维度 tab + 长解读 / 属性扩展 | [ ] |
| §12 Header & BottomNav | 52px / 56px / blur / 3 tab + ✦ active | [ ] |
| §13 Loading / Error | "小恙" + pearl pink dot + 重试按钮 | [ ] |
| §14 动画 | 摇签淡入 / 4 宫格 stagger / 分数 count-up | [ ] |

差距 ≥30% 视觉感知的单元 → 立即修；改不动的 → 列入 V1.0.1。13 个上线必备单元（§10 跳过 + §14 部分 V1.0.5）至少 11 个达标才放行。

- [ ] **Step 3: 抓 P0 bug 并立即 fix**

每发现 P0（流式不动 / 表单提交失败 / 卡片渲染错乱）→ 马上停下修。修不动的 P1/P2 进 V1.0.1 清单。

- [ ] **Step 4: 同时在 iOS Safari 直接打开测一遍（非微信）**

确认非微信浏览器也能跑（避免被微信 sandbox 隐藏的问题误以为通过）。

- [ ] **Step 5: 把 5 路径回归状态写进 README**

```md
## 上线前真机回归
- 2026-MM-DD：W5 末微信 X5 / iOS Safari 5 路径全绿；遗留 P1 bug：[列表]
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/wechat-regression-checklist.md README.md
git commit -m "test: W5 末微信真机回归 5 路径"
```

**预估工时：** 3h（含真机来回 + 修 P0）

---

## Section O — 埋点 Plausible（W5 D5）

### Task O1: lib/analytics/plausible.ts + script 注入

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/lib/analytics/plausible.ts`
- Modify: `/Users/edy/Desktop/workspace/occult/app/layout.tsx`

- [ ] **Step 1: 注册 Plausible（或 Umami）**

plausible.io → Add a site → 输 vercel 域名 → 拿到 script 标签。

> 若用 Umami（自托管 Vercel 项目）成本更低；步骤同。

- [ ] **Step 2: layout.tsx 注入 script**

```tsx
import Script from "next/script";

// 在 <head> 区域追加
<Script
  defer
  data-domain="<your-vercel-domain>.vercel.app"
  src="https://plausible.io/js/script.tagged-events.js"
  strategy="afterInteractive"
/>
```

- [ ] **Step 3: lib/analytics/plausible.ts**

```ts
type PlausibleProps = Record<string, string | number | boolean>;

export function track(event: string, props?: PlausibleProps) {
  if (typeof window === "undefined") return;
  const p = (window as any).plausible;
  if (typeof p === "function") {
    p(event, props ? { props } : undefined);
  }
}

// 预定义事件常量，避免拼错
export const EVENTS = {
  ONBOARDING_DONE: "onboarding_done",
  CHAT_OPENED: "chat_opened",
  DIVINATION_QIANWEN_DONE: "qianwen_done",
  DREAM_DONE: "dream_done",
  BAZI_INTERPRETED: "bazi_interpreted",
  MEIHUA_CASTED: "meihua_casted",
  MEIHUA_WAIYING_FILLED: "meihua_waiying_filled",
  MEIHUA_WAIYING_SKIPPED: "meihua_waiying_skipped",
  ERROR: "error",
  FEEDBACK_SUBMITTED: "feedback_submitted",
} as const;
```

- [ ] **Step 4: 在关键路径上埋点**

| 文件 | 位置 | 事件 |
|---|---|---|
| `app/api/profile/route.ts` POST 成功 | server-side（用 fetch 发到 plausible API event 端点）或 client-side（onboarding 提交回调） | `ONBOARDING_DONE` |
| `app/chat/page.tsx` mount | client | `CHAT_OPENED` |
| `MeihuaInputCard` submit 成功 | client | `MEIHUA_CASTED`，props={method} |
| `MeihuaWaiyingPrompt` submit 分支 | client | `MEIHUA_WAIYING_FILLED` 或 `_SKIPPED` |
| `app/error.tsx` | client | `ERROR` |
| `/me` 反馈提交（P 任务） | client | `FEEDBACK_SUBMITTED` |

埋点示例（在 MeihuaInputCard.tsx submit 中）：

```ts
import { track, EVENTS } from "@/lib/analytics/plausible";
// submit 成功后：
track(EVENTS.MEIHUA_CASTED, { method });
```

- [ ] **Step 5: 装 plausible 后访问几次确认面板能看到事件**

24h 内 Plausible 面板应有 ≥1 PV + 各事件计数。

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/ app/layout.tsx app/chat/page.tsx app/chat/_components/MeihuaInputCard.tsx app/chat/_components/MeihuaWaiyingPrompt.tsx app/error.tsx app/api/profile/route.ts
git commit -m "feat(analytics): 接入 Plausible + 关键路径埋点"
```

**预估工时：** 2.5h

---

## Section P — 生产部署 + 反馈入口 + 运营准备（W5 D5）

### Task P1: feedback 表 + /api/feedback + /me 入口

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/db/migrations/0004_feedback.sql`
- Create: `/Users/edy/Desktop/workspace/occult/app/api/feedback/route.ts`
- Modify: `/Users/edy/Desktop/workspace/occult/app/me/page.tsx`

- [ ] **Step 1: migration**

```sql
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  content text not null check (char_length(content) between 1 and 2000),
  contact text,
  page text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy feedback_self_insert on public.feedback
  for insert with check (auth.uid() = user_id or user_id is null);
create policy feedback_admin_read on public.feedback
  for select using (false);  -- 仅 service role 读
```

- [ ] **Step 2: /api/feedback**

```ts
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { containsSensitive } from "@/lib/safety/filter";

const schema = z.object({
  content: z.string().min(1).max(2000),
  contact: z.string().max(200).optional(),
  page: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("bad request", { status: 400 });
  if (containsSensitive(parsed.data.content).hit) return new Response("blocked", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from("feedback").insert({
    user_id: user?.id ?? null,
    content: parsed.data.content,
    contact: parsed.data.contact,
    page: parsed.data.page,
    user_agent: req.headers.get("user-agent") ?? undefined,
  });
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 3: /me 加吐槽按钮 + 简易表单**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { track, EVENTS } from "@/lib/analytics/plausible";

function FeedbackForm() {
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [open, setOpen] = useState(false);
  async function submit() {
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, contact, page: window.location.pathname }),
    });
    if (r.ok) {
      toast.success("收到了，我们会看的");
      track(EVENTS.FEEDBACK_SUBMITTED);
      setText(""); setContact(""); setOpen(false);
    } else {
      toast.error("提交失败，再试一次");
    }
  }
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>吐槽 / 反馈</Button>;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Textarea rows={3} placeholder="哪里好用 / 哪里坑" value={text} onChange={(e) => setText(e.target.value)} />
      <input className="w-full border rounded px-2 py-1 text-sm" placeholder="联系方式（选填）" value={contact} onChange={(e) => setContact(e.target.value)} />
      <div className="flex gap-2"><Button size="sm" onClick={submit}>提交</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>取消</Button></div>
    </div>
  );
}
```

把 `<FeedbackForm />` 嵌进 `app/me/page.tsx`（`"use client"` 拆成子组件）。

- [ ] **Step 4: apply migration + 测**

```bash
ts=$(date +%Y%m%d%H%M%S)
cp db/migrations/0004_feedback.sql "supabase/migrations/${ts}_feedback.sql"
supabase db push
```

`/me` → 吐槽 → 写"测试" → 提交 → 进 Studio 看到一行。

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0004_feedback.sql app/api/feedback/route.ts app/me/page.tsx
git commit -m "feat(feedback): 反馈入口 + 个人页吐槽按钮"
```

**预估工时：** 2h

---

### Task P2: 生产部署 + 上线公告 + spec 修订摘要

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/docs/superpowers/specs/2026-04-24-qingyun-ai-design.md`
- Modify: `/Users/edy/Desktop/workspace/occult/README.md`

- [ ] **Step 1: 把所有 P3 改动合并到 main 并 push**

```bash
git checkout main
git merge --no-ff p3-launch -m "feat: P3 上线期完成 — 梅花对话流 + 外应分支 + 安全/性能/运营三件套"
git push origin main
```

- [ ] **Step 2: 在 vercel 把 production 域名指向最新 deployment**

Vercel 自动 promote main 到 production。

- [ ] **Step 3: 生产 smoke**

- /api/healthz → 200
- /onboarding → 完整跑通
- /chat → 5 条路径在生产域名上各跑一次（可串简化版 e2e 脚本）
- Plausible 面板看到 PV 进来

- [ ] **Step 4: spec 顶部追加修订摘要**

```md
> **本次修订摘要**：
> - 2026-04-24 V1 初稿
> - 2026-04-24 加入梅花易数档 4
> - 2026-MM-DD: P1 完成
> - 2026-MM-DD: P2 完成（W3 gate [通过/降级]）
> - 2026-MM-DD: P3 完成 — V1.0 MVP 上线 https://<vercel-domain>
```

- [ ] **Step 5: README 顶部加上线徽章**

```md
# 福小运 · V1.0
> 🎉 V1.0 已上线：https://<your-domain>.vercel.app
```

- [ ] **Step 6: 上线后 24h 看面板**

- DAU、关键漏斗（onboarding_done → chat_opened → divination_done）
- error 事件数量；超过 5 个/24h 立刻看 Plausible 详情 + 修

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-04-24-qingyun-ai-design.md README.md
git commit -m "docs: V1.0 上线"
git push
```

**预估工时：** 2h（含监控）

---

## ═══════════════ V1.0.5（V1.0 上线后 W6–W7）═══════════════

> **目标：** 把 P2 留在 `lib/meihua/casting/` 的 3 个桩文件实现成真功能，把 `MeihuaInputCard` 5 种起卦方式全部解锁。前置：V1.0 上线稳定运行 ≥7 天，无 P0 bug 残留。

### Task Q1: 报数起卦（random-casting.ts）

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/lib/meihua/casting/random-casting.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/meihua/casting/random-casting.test.ts`

- [ ] **Step 1: 写测试**

```ts
import { describe, it, expect } from "vitest";
import { randomCast } from "./random-casting";

describe("randomCast", () => {
  it("无 seed: 三个数字都在合理范围", () => {
    const r = randomCast();
    expect(r.numbers).toHaveLength(3);
    r.numbers.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(999);
    });
  });
  it("有 seed: 同 seed 同结果", () => {
    const a = randomCast({ seed: 42 });
    const b = randomCast({ seed: 42 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: 实现**

```ts
import type { CastInput } from "../types";

interface RandomOptions { seed?: number }

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomCast(opts: RandomOptions = {}): { numbers: number[] } {
  const rand = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random;
  const numbers = [
    Math.floor(rand() * 999) + 1,
    Math.floor(rand() * 999) + 1,
    Math.floor(rand() * 999) + 1,
  ];
  return { numbers };
}

/** 给 castAndAnalyze 用的统一适配器 */
export function castFromRandom(): CastInput {
  const { numbers } = randomCast();
  return { method: "random", raw: { numbers, castAt: new Date().toISOString() } };
}
```

> 上层 `lib/meihua/index.ts` 的 `castAndAnalyze({method:'random'})` 内部调 `castFromRandom()` → `castFromNumber(numbers)` 复用 P2 已实现的 number-casting 推演逻辑。

- [ ] **Step 3: Commit**

```bash
git add lib/meihua/casting/random-casting.ts lib/meihua/casting/random-casting.test.ts
git commit -m "feat(meihua/v105): 报数起卦"
```

**预估工时：** 1.5h

---

### Task R1: 文字起卦（stroke-casting.ts，按笔画）

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/scripts/seed-strokes-dict.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/meihua/casting/strokes.json`
- Modify: `/Users/edy/Desktop/workspace/occult/lib/meihua/casting/stroke-casting.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/meihua/casting/stroke-casting.test.ts`

- [ ] **Step 1: 找笔画字典 npm 包**

候选：`cn-stroke-order` / `chinese-strokes` / `cn-char-strokes`。挑一个含 ~3500 常用汉字笔画的。

```bash
pnpm add cn-char-strokes  # 假设包名
```

- [ ] **Step 2: seed 脚本一次性导出 JSON**

`/Users/edy/Desktop/workspace/occult/scripts/seed-strokes-dict.ts`：

```ts
import fs from "node:fs";
import path from "node:path";
import strokes from "cn-char-strokes";  // 或 require

const out: Record<string, number> = {};
for (const c of Object.keys(strokes)) {
  out[c] = (strokes as any)[c];
}
fs.writeFileSync(
  path.join(__dirname, "../lib/meihua/casting/strokes.json"),
  JSON.stringify(out, null, 0),
);
console.log(`导出 ${Object.keys(out).length} 字`);
```

```bash
pnpm tsx scripts/seed-strokes-dict.ts
```

- [ ] **Step 3: stroke-casting.ts 实现**

```ts
import strokesDict from "./strokes.json";
import type { CastInput } from "../types";

export function strokesOf(text: string): number[] {
  return [...text].map((c) => (strokesDict as any)[c] ?? 0);
}

/**
 * 输入 2 个汉字。
 * 起法：上卦 = 第 1 字笔画 mod 8（0→8）；下卦 = 第 2 字笔画 mod 8；动爻 = 总笔画 mod 6（0→6）
 */
export function strokeCast(text: string): { upperRaw: number; lowerRaw: number; dongYaoRaw: number } {
  if ([...text].length !== 2) throw new Error("必须传 2 个汉字");
  const [s1, s2] = strokesOf(text);
  if (s1 === 0 || s2 === 0) throw new Error(`字典不含: ${text}`);
  return { upperRaw: s1, lowerRaw: s2, dongYaoRaw: s1 + s2 };
}

export function castFromText(text: string): CastInput {
  const { upperRaw, lowerRaw, dongYaoRaw } = strokeCast(text);
  return {
    method: "stroke",
    raw: {
      text,
      strokes: [upperRaw, lowerRaw],
      derived: {
        upper: ((upperRaw - 1) % 8) + 1,
        lower: ((lowerRaw - 1) % 8) + 1,
        dongYao: ((dongYaoRaw - 1) % 6) + 1,
      },
    },
  };
}
```

> 注：与 number-casting (3 数字)的"上 = N1 mod 8, 下 = N2 mod 8, 动 = N3 mod 6"分支一致，复用 derivation 层。

- [ ] **Step 4: 测试**

```ts
import { describe, it, expect } from "vitest";
import { strokesOf, strokeCast } from "./stroke-casting";

describe("strokesOf", () => {
  it("常用字命中字典", () => {
    expect(strokesOf("天")).toEqual([4]);
    expect(strokesOf("地")).toEqual([6]);
  });
});

describe("strokeCast", () => {
  it("天地: 上卦 4(震), 下卦 6(坎), 动爻 (4+6) mod 6 = 4", () => {
    const r = strokeCast("天地");
    expect(r.upperRaw).toBe(4);
    expect(r.lowerRaw).toBe(6);
    expect(r.dongYaoRaw).toBe(10);
  });
  it("非 2 字抛错", () => {
    expect(() => strokeCast("天地人")).toThrow();
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-strokes-dict.ts lib/meihua/casting/strokes.json lib/meihua/casting/stroke-casting.ts lib/meihua/casting/stroke-casting.test.ts package.json
git commit -m "feat(meihua/v105): 文字起卦 (按笔画)"
```

**预估工时：** 3h

---

### Task S1: 摇铜钱起卦（coin-casting.ts + Lottie 动画）

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/lib/meihua/casting/coin-casting.ts`
- Create: `/Users/edy/Desktop/workspace/occult/lib/meihua/casting/coin-casting.test.ts`
- Create: `/Users/edy/Desktop/workspace/occult/components/lottie/CoinTossAnimation.tsx`
- Create: `/Users/edy/Desktop/workspace/occult/public/lottie/coin-toss.json`

- [ ] **Step 1: 准备 Lottie 素材**

去 lottiefiles.com 找"coin flip" / "coin toss"免费动画 → 下载 JSON → 放 `/public/lottie/coin-toss.json`。

> 备案：找不到合适的 → 用 CSS keyframe + 3 个圆形 div 的 360° rotateY 动画手写。

```bash
pnpm add lottie-react
```

- [ ] **Step 2: CoinTossAnimation.tsx**

```tsx
"use client";
import Lottie from "lottie-react";
import animation from "@/public/lottie/coin-toss.json";

export function CoinTossAnimation({ onComplete }: { onComplete: () => void }) {
  return (
    <Lottie
      animationData={animation}
      loop={false}
      onComplete={onComplete}
      style={{ width: 200, height: 200 }}
    />
  );
}
```

- [ ] **Step 3: coin-casting.ts 实现**

```ts
import type { CastInput } from "../types";

/** 单次铜钱投掷：3 枚铜钱组合 → 老阴/少阳/少阴/老阳 */
function tossOnce(rand: () => number): { yaoType: "老阴" | "少阳" | "少阴" | "老阳"; bits: number[] } {
  // 每枚铜钱：0=反（2）, 1=正（3）；3 枚和 = 6/7/8/9
  const bits = [0, 0, 0].map(() => (rand() < 0.5 ? 0 : 1));
  const sum = bits.reduce((a, b) => a + b, 0) * 1 + (3 - bits.reduce((a, b) => a + b, 0)) * 0;
  // 用经典规则：3 反 = 6 老阴（变阳）、2 反 1 正 = 7 少阳、1 反 2 正 = 8 少阴、3 正 = 9 老阳（变阴）
  const heads = bits.filter((b) => b === 1).length;
  let yaoType: "老阴" | "少阳" | "少阴" | "老阳";
  if (heads === 0) yaoType = "老阴";
  else if (heads === 1) yaoType = "少阳";
  else if (heads === 2) yaoType = "少阴";
  else yaoType = "老阳";
  return { yaoType, bits };
}

export function coinCast(rand: () => number = Math.random) {
  const yaos: Array<"老阴" | "少阳" | "少阴" | "老阳"> = [];
  const tosses: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const t = tossOnce(rand);
    yaos.push(t.yaoType);
    tosses.push(t.bits);
  }
  // 由 6 爻（自下而上）→ 本卦 + 动爻位（取第一个变爻；如多变取最低）
  // 后续把"老阴/老阳"位标动爻；少阴少阳作为定爻
  const dongIdx = yaos.findIndex((y) => y === "老阴" || y === "老阳");
  const dongYao = dongIdx >= 0 ? dongIdx + 1 : 1;
  // 上下卦：3-1 爻为下卦，6-4 爻为上卦
  const lower = trigramFromYaos(yaos.slice(0, 3));
  const upper = trigramFromYaos(yaos.slice(3, 6));
  return { lowerRaw: lower, upperRaw: upper, dongYaoRaw: dongYao, tosses };
}

/** 把 3 爻（阴=偶, 阳=奇）映射成八卦序号 1-8 */
function trigramFromYaos(yaos: Array<"老阴" | "少阳" | "少阴" | "老阳">): number {
  // 自下而上 → 二进制位（下=低位）：0=阴, 1=阳；先天序映射表
  const bits = yaos.map((y) => (y === "老阳" || y === "少阳" ? 1 : 0));
  const idx = bits[0] | (bits[1] << 1) | (bits[2] << 2);
  // 先天序：000=坤(8), 001=震(4), 010=坎(6), 011=兑(2), 100=艮(7), 101=离(3), 110=巽(5), 111=乾(1)
  const MAP = [8, 4, 6, 2, 7, 3, 5, 1];
  return MAP[idx];
}

export function castFromCoin(): CastInput {
  const r = coinCast();
  return { method: "coin", raw: { tosses: r.tosses, derived: { upper: r.upperRaw, lower: r.lowerRaw, dongYao: r.dongYaoRaw } } };
}
```

> 注：与 derivation 层兼容性 — derivation 期望 `{upper, lower, dongYao}` 标准三元组；本任务的 `derived` 即此结构，复用 P2 上层零改动。

- [ ] **Step 4: 测试（用固定 seed 的 rand）**

```ts
import { describe, it, expect } from "vitest";
import { coinCast } from "./coin-casting";

describe("coinCast", () => {
  it("固定 seed 复现", () => {
    let i = 0;
    const seq = [0.1, 0.6, 0.7, 0.2, 0.8, 0.3, 0.9, 0.4, 0.55, 0.45, 0.65, 0.35, 0.25, 0.85, 0.15, 0.5, 0.95, 0.05];
    const rand = () => seq[i++ % seq.length];
    const r = coinCast(rand);
    expect(r.tosses).toHaveLength(6);
    expect(r.upperRaw).toBeGreaterThanOrEqual(1);
    expect(r.upperRaw).toBeLessThanOrEqual(8);
    expect(r.lowerRaw).toBeGreaterThanOrEqual(1);
    expect(r.lowerRaw).toBeLessThanOrEqual(8);
    expect(r.dongYaoRaw).toBeGreaterThanOrEqual(1);
    expect(r.dongYaoRaw).toBeLessThanOrEqual(6);
  });
});
```

- [ ] **Step 5: 在 MeihuaInputCard 中接入动画 + coinCast**

T 任务里把"摇铜钱"按钮解锁后，点击触发 6 次 CoinTossAnimation 串联（或一次完整动画 + 真随机）。简化：单次动画 5s 后调 `castFromCoin()`。

- [ ] **Step 6: Commit**

```bash
git add lib/meihua/casting/coin-casting.ts lib/meihua/casting/coin-casting.test.ts components/lottie/CoinTossAnimation.tsx public/lottie/coin-toss.json package.json
git commit -m "feat(meihua/v105): 摇铜钱起卦 + Lottie 动画"
```

**预估工时：** 5h（含动画素材调试）

---

### Task T1: MeihuaInputCard 解锁 3 个占位 + 接桩

**Files:**
- Modify: `/Users/edy/Desktop/workspace/occult/app/chat/_components/MeihuaInputCard.tsx`

- [ ] **Step 1: 解锁灰按钮**

把 P3 任务 I3 时的灰按钮换成可点：

```tsx
<Button variant={method === "random" ? "default" : "outline"} onClick={() => setMethod("random")}>报数</Button>
<Button variant={method === "stroke" ? "default" : "outline"} onClick={() => setMethod("stroke")}>文字</Button>
<Button variant={method === "coin" ? "default" : "outline"} onClick={() => setMethod("coin")}>摇铜钱</Button>
```

- [ ] **Step 2: 各 method 输入分支**

```tsx
{method === "stroke" && (
  <input className="w-full border rounded px-3 py-2" placeholder="输 2 个汉字（如"事业"）"
    value={text} onChange={(e) => setText(e.target.value)} maxLength={2} />
)}
{method === "coin" && showAnim && (
  <CoinTossAnimation onComplete={() => setShowAnim(false)} />
)}
```

- [ ] **Step 3: submit 分发**

```ts
const payload =
  method === "time"   ? { method: "time" } :
  method === "number" ? { method: "number", numbers: numbers.split(/[, ]+/).filter(Boolean).map(Number) } :
  method === "random" ? { method: "random" } :
  method === "stroke" ? { method: "stroke", text } :
  method === "coin"   ? { method: "coin" } : null;
if (!payload) return;
if (method === "coin") setShowAnim(true);  // 动画跑完才发请求
```

为简化，`coin` 在动画 onComplete 后再 fire fetch。

- [ ] **Step 4: 后端 /api/divination/meihua route 加 method='random'/'stroke'/'coin' 分支**

P2 时 route 只支持 time/number；本任务加：

```ts
import { castFromRandom } from "@/lib/meihua/casting/random-casting";
import { castFromText } from "@/lib/meihua/casting/stroke-casting";
import { castFromCoin } from "@/lib/meihua/casting/coin-casting";

const cast =
  method === "time"   ? castFromTime() :
  method === "number" ? castFromNumber(numbers) :
  method === "random" ? castFromRandom() :
  method === "stroke" ? castFromText(text) :
  method === "coin"   ? castFromCoin() :
  null;
if (!cast) return new Response("不支持的起卦方式", { status: 400 });
```

- [ ] **Step 5: Commit**

```bash
git add app/chat/_components/MeihuaInputCard.tsx app/api/divination/meihua/route.ts
git commit -m "feat(meihua/v105): InputCard 5 种起卦方式全部解锁"
```

**预估工时：** 2h

---

### Task T2: 5 种起卦方式回归测试

**Files:**
- Create: `/Users/edy/Desktop/workspace/occult/e2e/meihua-v105.spec.ts`

- [ ] **Step 1: 端到端 5 种走一遍**

```ts
import { test, expect } from "@playwright/test";

const methods = ["time", "number", "random", "stroke", "coin"] as const;

for (const m of methods) {
  test(`梅花 ${m} 起卦端到端`, async ({ page }) => {
    await page.goto("/chat");
    await page.getByText("起一卦").click();
    await page.waitForSelector('[data-testid="meihua-input-card"]');
    await page.getByRole("button", { name: m === "time" ? "时间起卦" : m === "number" ? "数字起卦" : m === "random" ? "报数" : m === "stroke" ? "文字" : "摇铜钱" }).click();

    if (m === "number") await page.getByPlaceholder(/数字/).fill("12 34 56");
    if (m === "stroke") await page.getByPlaceholder(/汉字/).fill("事业");

    await page.getByRole("button", { name: "起卦" }).click();
    await page.waitForSelector('[data-testid="meihua-result-card"]', { timeout: 30000 });
    // 4 宫格存在
    await expect(page.locator('[data-testid="hexagram-cell"]')).toHaveCount(4);
  });
}
```

> 各 Card 需要在 P2/P3 实现时加 `data-testid` 标记便于 e2e。本任务一并补 testid。

- [ ] **Step 2: 跑 e2e**

```bash
pnpm e2e
```

Expected: 5 全绿；失败的 method 单独修。

- [ ] **Step 3: 真机回归 5 种 + 微信验证**

部署到 vercel preview → 微信扫 → 5 种各起一次 → 截图归档到 `docs/superpowers/specs/meihua-v105-regression.md`。

- [ ] **Step 4: spec 修订摘要追加**

```md
> - 2026-MM-DD: V1.0.5 完成 — 梅花 5 种起卦全部上线
```

- [ ] **Step 5: Commit + push**

```bash
git add e2e/meihua-v105.spec.ts docs/superpowers/specs/meihua-v105-regression.md docs/superpowers/specs/2026-04-24-qingyun-ai-design.md
git commit -m "test(meihua/v105): 5 种起卦方式 e2e + 真机回归"
git push
```

**预估工时：** 3h

---

## Self-Review Checklist

按 writing-plans 自审清单逐项核对：

### 1. Spec 覆盖

| spec 节 | 内容 | 对应 P3 Section/Task |
|---|---|---|
| 第 5.4 梅花外应收集（AI 对话式） | 末尾轻问 + 二次解读 | I4 + J1 + J2 + J3 |
| 第 6.4 (3) 梅花对话流（档 4） | InputCard → 起卦 → ResultCard → 流式解读 → 外应轻问 → 融合 | I1–I4 + J1–J2 |
| 第 6.5 易忽略但必做 · PWA | manifest + 添加到主屏幕 | M1 |
| 第 6.5 易忽略但必做 · 微信浏览器兼容 | X5 SSE 真机回归 | N1 |
| 第 6.5 易忽略但必做 · 敏感词过滤 | 输入侧过滤 | K1 + K2 |
| 第 6.5 易忽略但必做 · 错误边界 | error.tsx 强化 | L1 |
| 第 7 节 W5 | 上线 + 打磨 + 部署 | I/J/K/L/M/N/O/P |
| 第 10 节 上线后 2 周必做 · 埋点 | 关键漏斗 | O1 |
| 第 10 节 上线后 2 周必做 · 反馈入口 | /me 吐槽按钮 | P1 |
| 第 10 节 上线后 2 周必做 · 梅花复盘 | 真实卦例案例库 | （运营任务，非代码 — 由 user 在 spec/wechat-regression-checklist.md 持续 append） |
| 第 10bis V1.0.5 报数起卦 | 0.5 天 | Q1 |
| 第 10bis V1.0.5 文字起卦（笔画） | 1–1.5 天 | R1 |
| 第 10bis V1.0.5 摇铜钱 + Lottie | 2–3 天 | S1 |
| 第 10bis V1.0.5 InputCard 解锁占位 | 0.5 天 | T1 |
| 第 10bis V1.0.5 回归测试 | 1 天 | T2 |
| 第 9 节 风险 · 微信 SSE | W5 真机测 | N1（含失败回退预案） |
| 第 9 节 风险 · 梅花应期被挑错 | 持续收集真实卦例 | （P 节运营任务 + ying-qi.ts 单文件可替换） |

✅ 全部覆盖；运营类任务（梅花复盘、应期反馈循环）已在 P1 阶段确保了"单文件可替换"的架构基础（lib/meihua/ying-qi.ts），不需要额外代码任务。

### 2. Placeholder 检查

搜过文档："TBD" / "TODO" / "待定" / "fill in" / "implement later"。

- I3 Step 2 的"如果 P2 已经做了…如果 P2 是把…本任务把它拆开" — 这是对 P2 的兼容说明，不是占位 ✅
- M1 Step 1 的图标素材"用 v0.dev 或 Figma 出图" — 是 user 操作指南，非占位 ✅
- O1 Step 1 "或用 Umami（自托管 Vercel 项目）" — 备选方案明确写出 ✅
- S1 Step 1 "找不到合适的 → 用 CSS keyframe 兜底" — 备案写明 ✅
- 其余无占位。

### 3. 类型/方法签名一致性

- `track(event, props?)` 在 O1 定义，K2/MeihuaInputCard/MeihuaWaiyingPrompt/error.tsx 消费 ✅
- `containsSensitive(text): {hit, matched?}` / `sanitize(text): string` 在 K1 定义，K2/P1 消费 ✅
- `randomCast(opts?)` / `castFromRandom()` 在 Q1 定义，T1 后端 route 消费 ✅
- `strokeCast(text)` / `castFromText(text)` 在 R1 定义，T1 消费 ✅
- `coinCast(rand?)` / `castFromCoin()` 在 S1 定义，T1 消费 ✅
- `CastInput` 类型在 P2 任务 C 中已定义；Q1/R1/S1 复用一致 ✅
- 所有 V1.0.5 casting 实现都遵循同一份 `derivation.ts` 接口（输出 `{upper, lower, dongYao}` 三元组），不改 P2 上层 ✅

### 4. 范围检查

- P3 仅触及"梅花对话流接线 + 上线必备 + V1.0.5 起卦补完"
- 不重做 P1 骨架、不重写 P2 算法/prompt（仅 J3 调优 prompt v2，是 prompts 表新增版本而非改文件结构）
- V1.0.5 严格按 spec 第 10bis 节范围 ✅

### 5. 歧义检查

- "外应"在 prompt 内部判断五行（system 提示词内嵌外应五行表），不在前端 UI 让用户选 — 与 spec 第 5.4 节一致 ✅
- 摇铜钱 6 次组合的"老阴/少阳/少阴/老阳"映射规则与传统梅花规则一致；spec 没强制此规则，本计划 S1 内显式列出，未来若与 V1.1 规则引擎冲突可在 ying-qi.ts 整块替换的同时调整 ✅
- 5 种起卦方式都通过 `derivation.ts` 标准三元组进入推演 — 算法层零改动 ✅

### 6. 工时合计

| Section | 任务数 | 工时小计 |
|---|---|---|
| I 梅花对话流接线 | 4 | 10h |
| J 外应分支 | 3 | 6h（J1 含视觉走查 +0.5h）|
| K 敏感词 | 2 | 2.5h |
| L 错误边界 | 1 | 1.5h（含 loading.tsx + 视觉走查）|
| M PWA | 1 | 2h |
| N 微信回归 | 1 | 4h（含 14 单元终态视觉 gate +1h）|
| O 埋点 | 1 | 2.5h |
| P 部署 + 反馈 | 2 | 4h |
| **W5 P3 主体合计** | **15** | **32.5h** |
| Q 报数起卦 | 1 | 2.5h（+1h，含 mulberry32 seed 测试）|
| R 文字起卦 | 1 | 6h（+3h，含笔画字典 npm 包评估 + JSON 导出脚本调试 + 缺字 fallback）|
| S 摇铜钱 | 1 | 10h（+5h，Lottie 素材寻找/调试常超时 + 6 次铜钱状态机 + CSS keyframe 备案）|
| T 解锁 + 回归 | 2 | 8h（+3h，5 种 e2e + 微信真机回归实测）|
| **V1.0.5 合计** | **5** | **26.5h（≈ 3.3 工作日）**|
| **P3 总计** | **20** | **59h** |

W5 主体 32.5h ≈ 4 个工作日，预留 1 天处理上线后突发。V1.0.5 26.5h ≈ 3.3 工作日，分散在上线后第 6–7 周完成（与 spec §10bis 的 5–6.5 工作日估算对齐 — spec 估算含 user 自研环节如手工调素材、笔画字典选型决策等非纯 coding 时间，所以仍有 ~1 天 buffer）。

---

## Execution Handoff

**Plan complete and saved to `/Users/edy/Desktop/workspace/occult/docs/superpowers/plans/2026-04-24-qingyun-ai-p3-launch.md`. Two execution options:**

**1. Subagent-Driven（推荐）** — 每个 Task 派一个 fresh subagent。推荐切分：
- Section I/J 串行（梅花对话流强依赖）
- Section K/L/M 三个并行（互相独立）
- Section N 必须等 I/J/K/L/M 全部完成后跑（真机回归是终态测）
- Section O/P 顺序，O 先 P 后（埋点要先装才能在部署后看到数据）
- V1.0.5 的 Q/R/S 三个并行；T1 等 Q/R/S 都完成；T2 最后

**2. Inline Execution** — 在当前会话按 Section 顺序批量执行，每 Section 末做 checkpoint review。Section I/J 的代码联动多，inline 更顺手；K/L/M 简单可批量；N/O/P 涉及 vercel/plausible 控制台操作，必须停下来等 user 配置。

**Which approach?**

---

## V1.1 回补清单（来自 spec 第 11 节，本计划范围外）

按 spec 第 11 节优先级原文照搬，等 P3 + V1.0.5 全部上线后再启动新 plan：

1. 八字规则引擎对接（替换 `lib/fortune/scorer.ts`）
2. 多档案切换 UI
3. 微信授权登录 + 手机号绑定/换绑
4. 周/月运势详情
5. 精准解梦表单（4 字段）
6. 梅花易数档次升级（替换 `lib/meihua/ying-qi.ts`）
7. 每日运势定时推送（cron + 推送渠道）
8. 语音输入（ASR）
9. 会员/解锁未来运势
10. 塔罗牌
11. 自定义域名 + ICP 备案 + Cloudflare 前置加速
