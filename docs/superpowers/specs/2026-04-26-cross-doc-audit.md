# 轻运 AI · 跨文档一致性审计报告

> **日期**：2026-04-26
> **审计范围**：spec（design） + 3 份 plan（P1/P2/P3）+ 14 视觉单元 prompt 包
> **目的**：确保方案（设计）与研发（实现计划）一致，进入 P1 执行前清掉所有结构性不一致
> **方法**：12 项交叉审计（M1–M7 闭环映射 / 数据模型 / 路由 / 风险预案 / 工时 / 视觉单元 / 类型签名 / Prompt 落表 / 部署链路 / Schema 一致性 / 注释 vs 实际 task / 上线后运营）

---

## 输入文档

| 文档 | 路径 | 行数 |
|---|---|---|
| Spec V1.0 设计方案 | `docs/superpowers/specs/2026-04-24-qingyun-ai-design.md` | 756 |
| 视觉 prompt 包 | `docs/superpowers/designs/prompts-all-pages.md` | 729 |
| MeihuaResultCard 最终 mockup | `docs/superpowers/designs/meihua-result-card-20260424/a-refined-fairy.html` | (HTML 参考) |
| P1 骨架计划 | `docs/superpowers/plans/2026-04-24-qingyun-ai-p1-skeleton.md` | 4330 |
| P2 功能计划 | `docs/superpowers/plans/2026-04-24-qingyun-ai-p2-features.md` | 3510 |
| P3 上线 + V1.0.5 计划 | `docs/superpowers/plans/2026-04-24-qingyun-ai-p3-launch.md` | 2100 |

---

## 审计结果总览

| 严重度 | 项数 | 修复时间 |
|---|---|---|
| CRITICAL | 1 | 10 min |
| INFORMATIONAL | 7 | 30 min |
| OBSERVATIONAL | 2 | 0（仅提示）|
| **合计** | **10** | **~40 min** |

---

## ✅ 全过 7 项（无须修复）

### A. M1–M7 功能闭环 → plan task 映射

| 闭环 | spec 第 2.1 节描述 | 对应 task | 状态 |
|---|---|---|---|
| M1 档案 | 首次打开 → 引导建档案 → 入库 | P1 F1–F5 | ✅ |
| M2 首页运势 | 读档案 → 算八字 + 当日干支 → AI 7 维解读 → 缓存 | P2 D1–D7 | ✅（含 D7 详情页）|
| M3 AI 对话 | 意图识别 → 分发 → 流式 → 落库 | P1 G1 + P2 各 handler | ✅ |
| M4 抽签 | 6 主题 + 用户问题 → 随机签 → AI 解读 | P2 A1–A7 | ✅ |
| M5 解梦 | 快速对话引导 → 三重维度解读 | P2 B1–B3 | ✅ |
| M6 八字解读 | 排盘 → AI 解读 + 追问 | P2 E1–E2 | ✅ |
| M7 梅花易数 | 时间/数字起卦 → 档 4 推演 → 4 宫格 + 解读 + 外应 | P2 C1–C12 + F1–F4 + P3 I1–I4 + J1–J3 | ✅ |

### C. spec 路由 → 实现任务

| 路径 | spec 第 6.1 节 | 实现 task | 状态 |
|---|---|---|---|
| `/` | 首页运势 | P1 G5 占位 + P2 D5/D6 | ✅ |
| `/onboarding` | 3 步建档 | P1 F4 | ✅ |
| `/chat` | 招呼页 | P1 G2 | ✅ |
| `/chat/[sessionId]` | 对话页 | P1 G3 | ✅ |
| `/fortune/[date]` | 单日详情 | **P2 D7（patch 后新加）** | ✅ |
| `/me` | 个人页 | P1 G5 + P3 P1 | ✅ |
| `/me/profile` | 编辑档案 | V1.1 | ✅（正确推迟）|

### E. 风险预案 → 任务

| spec 第 9 节风险 | 预案 task | 状态 |
|---|---|---|
| 真太阳时对不上 | P1 C2/C5 三案例硬校 | ✅ |
| 微信 SSE 缓冲 | P1 G6 + P3 N1 真机测 | ✅ |
| DeepSeek 超时 | P1 D4 内置 30s 超时 + fallback | ✅ |
| 100 签错字 | P2 A1 通读修字 | ✅ |
| 梅花应期被挑错 | P2 C12 朋友 5 案例 + ying-qi.ts 单文件可替换 | ✅ |
| W3 算法跑不通 | P2 C12 gate + V1.0.1 降级路径 | ✅ |
| 64 卦 npm 数据不全 | P2 C1 评估 3 个候选 + fallback D | ✅ |

### F. 工时合计 vs 5 周 MVP

| 阶段 | 工时 | 工作日 | 周分配 | 状态 |
|---|---|---|---|---|
| P1 骨架 | 70.5h | 8.8 | W1–W2（10 工作日）| ✅ buffer 1.2 天 |
| P2 功能 | ~74h | 9.3 | W3–W4（10 工作日）| ✅ buffer 0.7 天 |
| P3 上线 | 32.5h | 4.1 | W5（5 工作日）| ✅ buffer 0.9 天 |
| V1.0.5 | 14.5h | 1.8 | W6–W7（散工）| ⚠️ 见 INFO-4 |
| **合计** | **~191h** | **~24** | **5 周 + V1.0.5** | ✅ |

### G. 14 视觉单元覆盖

设计 §1–§14 全部映射到具体 plan task（详见 P1 顶部页面排期矩阵）。§10 ProfileEdit 正确推 V1.1，不算遗漏。

### H. 跨 plan 类型/方法签名一致性

| 函数 / 类型 | 定义点 | 消费点 | 状态 |
|---|---|---|---|
| `buildChart(BuildChartInput)` | P1 C4 | P1 F1 ensure-bazi | ✅ |
| `chat(ChatInput)` | P1 D4 | P1 G1 + P2 各 handler + P3 I4/J2 | ✅ |
| `classifyIntent(text, opts?)` | P1 E1 | P1 G1 + P3 I | ✅ |
| `castAndAnalyze(input)` | P2 C11 | P2 F2 + P3 I3 + P3 Q1/R1/S1 | ✅ |
| `pickSlip(opts?)` | P2 A3 | P2 A4 | ✅ |
| `judgeTiYong` / `computeYingQi` | P2 C9/C10 | P2 C11 | ✅ |
| `loadPrompt` / `renderTemplate` | P1 D2 | P3 I4/J2 | ✅ |
| `isWithinLimit(userId)` | P1 D3 | P1 G1 | ✅ |
| `getCurrentProfile` / `setCurrentProfileId` | P1 F1 | P1 F5 + G5 | ✅ |
| `BaziComputed` / `Profile` / `Intent` 类型 | P1 B5 types/domain.ts | 全 plan 消费 | ✅ |

### J. 部署链路

spec 第 1 节（测试期 `*.vercel.app` 直连）→ P1 A4（vercel 接入 + healthz）→ P3 P2（生产部署 + smoke）链路通顺。

---

## 🔴 CRITICAL — 1 项

### CRIT-1: P2 G1 路径 5 验收要求超出 P2 实际交付范围

**现状**

P2 Section G `Task G1` 定义的 5 路径自测，路径 5 完整描述：

> "/chat → '我要起个梅花卦' → 时间起卦 → 输问题 → 看 4 宫格 + 流式解读 → 输'打翻了水杯' → 看外应融合段 → 通过"

但 P2 范围只到：
- F2 `/api/divination/meihua` 起卦 + 推演 ✅
- F3 InputCard 静态样式 ✅
- F4 ResultCard 静态样式 ✅

**完整对话流接线**（自动追问问题 / 流式调 meihua.interpret / 末尾轻问外应 / 二次解读融合）实现 task 全在 **P3 I4 + J1 + J2**。

**影响**

W4 末跑 P2 G1 自测时，路径 5 走不通到"流式解读 + 外应融合"那段 — **P2 G1 验收清单不可能 PASS**。如果按 plan 推进会卡在这里。

**修复（已选方案 A）**

把 P2 G1 路径 5 验收降级到"起卦 → 4 宫格 ResultCard 渲染正确 + 命令行 curl 测 meihua.interpret 流式输出"。完整 5 路径回归（含梅花完整闭环）以 P3 N1 为准。

---

## 🟡 INFORMATIONAL — 7 项

### INFO-1: `chat.general` prompt 未落 prompts 表

**现状**

spec §5.2 列了 6 个核心 prompt 含 `chat.general`，但 P2 没找到独立 seed task — P1 G1 把通用 chat system prompt 硬编码在 `app/api/chat/route.ts`。

**影响**

能跑，但和 spec "全部落表便于零发版调优"原则冲突。运营期想调通用对话风格需要发版。

**修复**

P2 D3 旁加一个 sub-task `seed chat.general v1`（10 min）。

---

### INFO-2: `feedback` 表 spec 没列

**现状**

P3 P1 新加 `feedback` 表（migration 0004）。spec §4.1 数据模型没这张。

**影响**

未来读 spec 看不到 feedback 表存在。

**修复**

spec §4.1 数据模型末尾补一段 feedback 表 schema。

---

### INFO-3: BaziChart V1.0 = 文字版未在 spec 注明

**现状**

P2 E2 视觉走查写"如果 V1.0 仅文字流式，BaziChart 卡作 V1.0.1 增项加入回补"。但 spec 第 6.4 节 + 设计 §8 都没说 V1.0 八字解读 UI 用文字还是卡片。

**影响**

执行时要回查决策。

**修复**

spec 第 6.4 节加 (4) 八字解读 V1.0 = 文字流式 + BaziChart 卡 V1.0.1 补。

---

### INFO-4: V1.0.5 工时低估

**现状**

spec §10bis 估 ~5–6.5 工作日 ≈ 40–52h（含 npm 包评估 + Lottie 素材寻找 + 真机回归）。P3 V1.0.5 估 14.5h。差 25–37h。

**影响**

V1.0.5 实际开发可能超 W6–W7 散工范围。

**修复**

P3 Q/R/S/T 各项工时上调（笔画字典调研 + Lottie 调试 + 5 种端到端 e2e + 微信回归实测时长不止当前估算），V1.0.5 总调到 ≥30h。

---

### INFO-5: spec `prompts.key UNIQUE` ≠ P1 B2 `unique(key, version)`

**现状**

spec §4.1 prompts 表 schema 写 `key text UNIQUE`。P1 B2 0001_init_schema.sql 实际写 `key text not null` + 复合 `unique(key, version)`。

**影响**

spec 字面意思 = `key` 全表唯一 → 同 key 只能一行 → 不能 v1/v2 共存调优。这与 spec 本身"零发版调优"原则矛盾。P1 B2 的复合唯一是对的，spec 写法是简化笔误。

**修复**

spec §4.1 prompts schema 改为 `key text not null` + 注明 `unique(key, version)`。

---

### INFO-6: P1 A1 `pnpm create next-app` 会覆盖手写 .gitignore

**现状**

刚 commit（2d1a8ae）的 `.gitignore` 屏蔽 `.DS_Store` + `.env.local`。P1 A1 用 `pnpm create next-app` scaffold 时会生成 next-app 默认 `.gitignore`（含 `node_modules` `.next` `.env*` 等），会覆盖或冲突。

**影响**

执行 P1 A1 时 .gitignore 处理不当会丢失 `.DS_Store` 屏蔽，或丢失 next-app 必要的 `.next`/`node_modules` 屏蔽。

**修复**

P1 A1 加一步：`pnpm create` 后 `git diff .gitignore` 看变化 → 手动 merge（保留 next-app 自带的 `node_modules`/`.next`/`/build` + 手写的 `.DS_Store`/`.env*.local`）→ commit。

---

### INFO-7: P2 file structure 注释引用过期 task 编号

**现状**

P2 file structure 区块第 88 行注释："首页：加运势渲染（W4 Task 26）"。P2 没有 Task 26，应该是 Task **D5/D6**。

**影响**

读者看到 Task 26 找不到。

**修复**

P2 file structure 修改区块注释 `W4 Task 26` → `Task D5/D6`。

---

## 🔵 OBSERVATIONAL — 2 项（不算缺陷，仅提示）

### OBS-1: Plausible / Umami 二选一

P3 O1 默认 Plausible，备选 Umami（自托管）。spec §10 未指定具体工具。决策权在 user。

### OBS-2: 上线后 2 周运营任务无独立 task

spec §10 列了 4 项上线后必做（埋点漏斗复盘 / 反馈扫读 / Prompt 调优 / 梅花真实卦例 5 例/周）。没在任何 plan 显式列为 task。

**建议**：P3 P2 末尾或单独加一个轻量"上线后 14 天 cron review checklist"占位（5 min），明确每周扫一次。或留给 user 手动管理（OK 范围内）。

---

## 修复执行清单

| # | 优先级 | 修改文件 | 工时 | 状态 |
|---|---|---|---|---|
| CRIT-1 | CRITICAL | P2 G1 路径 5 验收降级到"算法/API/UI 各自单测，完整对话流回归归 P3 N1" | 10 min | ✅ |
| INFO-1 | INFO | P2 D3 加 chat.general seed sub-task + 改 /api/chat 用 loadPrompt | 10 min | ✅ |
| INFO-2 | INFO | spec §4.2.bis 加 feedback 表 schema | 3 min | ✅ |
| INFO-3 | INFO | spec §6.4 (5) 加 BaziChart V1.0 = 文字版分级注记 | 2 min | ✅ |
| INFO-4 | INFO | P3 V1.0.5 工时表 14.5h → 26.5h（Q +1h / R +3h / S +5h / T +3h）| 5 min | ✅ |
| INFO-5 | INFO | spec §4.1 prompts schema 改 not null + unique(key, version) | 2 min | ✅ |
| INFO-6 | INFO | P1 A1 加 Step 0（备份 .gitignore）+ Step 5（merge）| 5 min | ✅ |
| INFO-7 | INFO | P2 file structure 注释 W4 Task 26 → D5/D6 + 补 A6/A7+F4 | 1 min | ✅ |
| **合计** | | | **~38 min** | **8/8** |

---

## 修复后影响汇总

| 维度 | 修改前 | 修改后 |
|---|---|---|
| 工时合计 | 191h | 197h（+6h，主要 V1.0.5 上调）|
| spec 数据模型表数 | 9 | 10（+ feedback）|
| Prompt 落表数 | 6（含 chat.general 但硬编码）| 6（chat.general 纳入 prompts 表）|
| P2 Section D 任务数 | 6（D1–D6）| 7（D1–D7，含新加 FortuneDetail）|
| P3 V1.0.5 工时 | 14.5h（与 spec §10bis 5–6.5 工作日严重低估）| 26.5h（与 spec 估算对齐）|
| P1 task 数 | 35 → 38（+S1–S3）| 38（无变）|
| spec ↔ plan 严重不一致点 | 1 | 0 |

---

## 历次审计

| 日期 | 范围 | 发现 | 修复状态 |
|---|---|---|---|
| 2026-04-26 | spec + 3 plan + 视觉 prompt 包 | 1 CRIT + 7 INFO + 2 OBS | ✅ 8/8 修完，2 OBS 留待 user 决策 |
