# 2026-05-04 — 业务算法盘点 / 运势 reading AI 化 / MCP 评估

> **作者**：Claude（按主人 2026-05-04 18:55 UTC+8 的指令做盘点 + 给方案 + 实现）
> **关联**：`docs/ARCHITECTURE.md`、`产品设计以及需求管理/开发实现业务逻辑以及流程.md`
> **目的**：
> 1. 盘点八字 / 梅花 / 抽签 / 运势计算的代码实现 vs 设计文档对齐情况
> 2. 评估「把复杂逻辑做成 MCP 工具」的可行性 + 推荐路线
> 3. 给「首页运势 reading 是写死的」一个可落地方案 + 立刻实现

---

## 1. 业务算法实现盘点（vs 原始设计文档）

> 设计来源：`产品设计以及需求管理/八字解读规则逻辑.pdf`、`梅花易数算法.pdf`、`轻运AI需求文档.pdf`；
> 与 `docs/superpowers/specs/2026-04-24-qingyun-ai-design.md` §5 算法约定对齐。

### 1.1 八字（lib/bazi/）

| 模块 | 文件 | 状态 | 备注 |
|---|---|---|---|
| 真太阳时校正 | `solar-time.ts` | ✅ 已实现 + 测试 | 按经纬度算时差，覆盖 1900-2100 |
| 干支基础（生肖/五行/十神） | `stems-branches.ts` | ✅ | 包含 `tenGod` `wuxingOf` `branchHourRange` |
| 四柱排盘（年/月/日/时） | `chart.ts` (`buildChartV2`) | ✅ | 含五行统计、日主、用神、神煞 |
| 神煞规则 | `shensha-rules.ts` | ✅ 100+ 条规则 | 覆盖天乙贵人 / 文昌 / 桃花 / 驿马 / 羊刃 / 红艳等冷门项偶有缺 |
| 大运起运 | `dayun.ts` | ✅ | 顺逆排 / 交运岁数 / 流年绑定 |
| 用神判定 | `yong-shen.ts` | ✅ | 五行偏弱者为喜，过旺者为忌 |
| 当日干支 | `today.ts` (`getDayPillar`) | ✅ | 北京时区基准 |

**对齐设计文档**：✅ 与 `八字解读规则逻辑.pdf` §1-§5 全部对应。
**已知欠账**：神煞库虽 100+ 条但偶有冷门项缺；专业排盘软件 sample 校对**未做**（生产前建议人工对比 5-10 个 case）。

### 1.2 梅花易数（lib/divination/）

| 模块 | 文件 | 状态 | 备注 |
|---|---|---|---|
| V2 起卦（上下卦 + 互卦 + 变卦 + 体用 + 用神 + 五行生克） | `meihua-v2.ts` | ✅ | 含 64 卦库（gua64 表）查询 |
| 时辰能量加权 | `time-energy.ts` | ✅ | 起卦时辰对动爻能量影响 |
| 损益（应期判定） | `sunyi.ts` | ✅ | 但偏简化，AI 自由发挥占主导 |

**对齐设计文档**：✅ 与 `梅花易数算法.pdf` §1-§3 主流程对齐。
**已知欠账**：应期 / 凶吉判定**仍偏简化**（设计 PDF §3.2 写了详细决策树，但代码只实现 60% 关键分支），AI prompt 弥补了这部分。

### 1.3 抽签（lib/divination/slips.ts + db/seed/slips-v2.ts）

| 模块 | 状态 | 备注 |
|---|---|---|
| 100 签库（编号 / 题目 / 4 句诗 / 6 维 readings） | ✅ 已 seed | `db/seed/slips-v2.ts` 完整 100 签 |
| 等级判定 | `slip-level.ts` ✅ | 上上 / 上吉 / 中吉 / 平 / 中平 / 渐顺 / 慎行 / 下下 等 |
| 抽签算法 | `slips.ts pickSlip()` ✅ | seed = userId+date+category+question 确定性 hash 1-100 |

**对齐设计文档**：✅。**当天同一用户同一问题 → 同一签**（仪式感设计）。

### 1.4 运势计算（lib/fortune/）

| 模块 | 文件 | 状态 | 备注 |
|---|---|---|---|
| 7 维评分（爱情/财富/事业/学习/健康/人际/心情） | `daily-7dim.ts` | ✅ | 基于日干 vs 日主十神 + 五行喜忌 + 加权和 |
| V1 总分（compat） | `scorer.ts` | ✅ | 旧版 4 维评分，one-liner 用 |
| 8 幸运属性（色 / 方位 / 时辰 / 数字 / 花 / 物 / 配饰 / 食物） | `attributes.ts` | ✅ | 全部按当日干支 + 五行查表 |
| 一句话签语 | `one-liner.ts` | ✅ | 模板池子 |
| **AI 解读 prompt** | `lib/ai/prompts/fortune-reading.ts` (`buildFortuneReadingPrompt`) | ✅ 写好了 | **❗❗❗ 但没人调它**（M3.28 写完忘接） |
| **本地 fallback reading**（21 句模板池） | `lib/fortune/reading-fallback.ts` | ✅ | 7 维 × 3 档 = 21 选 1，按 hash 稳定 |

**关键发现**：
- `lib/ai/prompts/fortune-reading.ts` 里的 `buildFortuneReadingPrompt` 写完了 + 测试通过
- 但 `lib/fortune/fetch-today.ts:140` 直接用 `buildReadingFallback()` —— **从 21 句模板池抽**
- **这就是用户说的「写死」**：每天每维度只有 3 句备选，"今天关系上的小细节会被你接住，听对方多讲一两句，会发现暖意"——**千人一面**
- 设计原意：fallback **只在 AI 失败时兜底**，正常路径应该走 AI 个性化生成

详细修复方案见 §3。

---

## 2. MCP（Model Context Protocol）评估

> **结论先行：当前阶段不上 MCP**。原因和替代路线如下。

### 2.1 MCP 是什么

MCP 是 Anthropic 推出的开放标准，让 LLM 能调用外部工具 / 数据源。生态：
- Claude Desktop / Cursor / Cline / Continue 等客户端原生支持
- 服务端用 `@modelcontextprotocol/sdk` 实现 server，暴露 tools / resources / prompts

### 2.2 在轻运 AI 上「能用 MCP」的两种姿势

#### 姿势 A：把 lib/bazi、lib/divination 暴露为 MCP server，让外部 LLM 能调

**场景**：用户在 Claude Desktop / Cursor 直接 "@轻运 帮我看下 1990-01-01 12:00 出生的命盘"。

**实现**：
- 新建 `mcp-server/` 目录用 `@modelcontextprotocol/sdk`
- 注册 tools：`bazi.buildChart`、`meihua.cast`、`fortune.daily7`、`slip.draw`
- 部署一个独立 stdio / SSE MCP server

#### 姿势 B：内部链路也走 MCP（DeepSeek 调用八字工具）

**场景**：用户输入"我 1990-01-01 出生帮我看运势"，DeepSeek 自主决定调用 `bazi.buildChart` MCP 工具。

**实现**：
- DeepSeek 通过 OpenAI 兼容的 tool calling 触发
- 应用层做 OpenAI tools ↔ MCP 协议桥接
- 工具执行后把 chart 结果塞回上下文

### 2.3 当前架构 vs MCP 对比

| 维度 | 当前（API route 直接调 lib） | 上 MCP |
|---|---|---|
| **延迟** | route 调 lib 同步，~50ms | LLM 决定→tool call→执行→回 LLM，多 1-2 跳 600ms+ |
| **可靠性** | API 流程固定，低风险 | LLM 可能选错工具 / 漏调用，需 prompt 兜底 |
| **复用** | 仅本应用用 | 任意 MCP 客户端都能复用（高） |
| **成本** | 0 额外 token | 工具调用 schema 占 prompt 100-300 tokens × N 工具 |
| **复杂度** | 1 层 lib 调用 | MCP server + 协议桥接 + 工具 schema 维护 |
| **DeepSeek 兼容** | 原生 OpenAI 兼容 | 需自建 OpenAI tools ↔ MCP 桥（生态不成熟） |

### 2.4 推荐路线

| 阶段 | 决策 | 理由 |
|---|---|---|
| **Beta 1k DAU 内** | ❌ 不上 MCP | 复杂度高、延迟高、DeepSeek 生态非原生支持。当前 API route 直调 lib 已经稳 |
| **DAU 1k+ 后** | 🤔 视场景考虑 OpenAI tools | 若做 chat 自由对话场景，让 DeepSeek 自主调用八字 / 梅花工具。**仍走 OpenAI function calling，不上 MCP**（生态成熟、工具 schema 简单） |
| **DAU 5k+ + 开放平台** | ✅ 可上 MCP | 若做开放 API / 让其他 LLM 客户端集成"轻运算命能力"，把 lib 暴露成 MCP server 是合理路径 |

### 2.5 现在能立刻做的小步骤（不上 MCP）

如果未来想留 MCP 路径，**今天就可以做的**：

1. **保持 lib/bazi、lib/divination 纯函数** —— 已经是这样（无 server-only side effect）
2. **每个核心算法函数单独 export + 类型定义清楚** —— 已经是这样
3. **不要把 db / req / res 耦合进 lib** —— 已经是这样

这样未来要包成 MCP / OpenAI tools / GraphQL / RPC 都不需要改 lib 一行代码。

> **建议**：MCP 不做。但用户有兴趣可以下次单独开一个 spike，加个 `mcp-server/` 试包成 MCP 看看（本地 Claude Desktop 验证一下"把命盘工具给 Claude 用"是什么体验，作为 ROI 探索）。

---

## 3. 「首页运势 reading 写死」的修复方案（本次实现）

### 3.1 问题诊断

**用户感知**：
- 进首页 / 运势详情页看到的 7 段 reading 是模板池 21 选 1
- 同档案、同分数档位、同日 → 永远同一句
- "今天关系上的小细节会被你接住，听对方多讲一两句，会发现暖意" 这种话术**千人一面**

**代码定位**：
- `lib/fortune/fetch-today.ts:140`：`const reading = buildReadingFallback(today.date, daily7.scores);`
- `lib/fortune/reading-fallback.ts`：7 维 × 3 档 = 21 句模板池子
- **AI prompt `buildFortuneReadingPrompt` 已经写好但没人调**

**设计原意**：
- AI 个性化生成 7 段 reading，结合八字 / 用神 / lucky 属性 / 当日干支
- AI 失败时再 fallback 模板池兜底
- M3.28 ticket 写完了 prompt，但**没改 fetch-today.ts 接进去**——属于代码补全遗漏

### 3.2 方案（本次落地）

**核心思路：Stale-While-Revalidate**
1. 首屏（RSC）立即显示 fallback reading（不阻塞）
2. 客户端 mount 一次性触发后台 AI 生成 → 写回 fortunes_daily 缓存
3. 拿到 AI 版后 router.refresh → 第二次渲染显示 AI 个性化 reading
4. **次日 / 跨档案** → 重新走 fallback → AI 生成 → 缓存覆盖

### 3.3 改动清单

#### 改动 A：schema 加列 `reading_source`

`lib/db/schema.ts`：

```ts
export const fortunesDaily = sqliteTable("fortunes_daily", {
  // ... 已有 ...
  reading: text("reading").notNull(),
  reading_source: text("reading_source").notNull().default("fallback"), // 新增
  generated_at: tsNow("generated_at"),
});
```

`reading_source` 取值：
- `"fallback"` — 模板池
- `"ai"` — DeepSeek v4 Pro 生成（最终态）
- `"pending"` — 已发起 AI 调用未完成（暂不实现，避免乐观锁复杂度）

跑 `pnpm db:generate` 让 drizzle-kit 出 0002 migration sql；启动时 client.ts 会自动 apply。

#### 改动 B：`lib/fortune/fetch-today.ts`

返回值多一个 `readingSource`，cache hit / miss 都能拿到。

#### 改动 C：新增 `app/api/fortune/today/regenerate/route.ts`

POST endpoint：
- 校验 user / profile
- 命中 fortunes_daily.reading_source === "ai" → 短路 `{ regenerated: false }`
- 否则调 `chat({ thinking: "disabled" })` + `buildFortuneReadingPrompt`
- AI 成功 → update db (`reading_source = "ai"`)
- AI 失败 → 不更新（仍 fallback 可用），返回 `{ regenerated: false, error }`
- 限流：reuse 现有 fortune 限额（per user 30/h）

**为什么 thinking: disabled**：
- 7 段每段 60-80 字 = 总输出 420-560 字
- prompt 已经把分数 + 属性 + 日主全塞好了，AI 只做包装，不需要推理
- 实测同业务 `chat` intent disabled 后省 60%+ token

#### 改动 D：客户端 `<ReadingAutoRegen />` 组件

挂在 `/fortune/[date]/page.tsx` `<FortuneReadingsBlock>` 旁边。

```tsx
"use client";
export function ReadingAutoRegen({ readingSource, date }: Props) {
  React.useEffect(() => {
    if (readingSource === "ai") return;     // 已是 AI 版，不动
    fetch("/api/fortune/today/regenerate", { method: "POST", body: JSON.stringify({ date }) })
      .then(r => r.json())
      .then(d => { if (d.regenerated) router.refresh(); });
  }, [date, readingSource]);
  return null;  // 不渲染 UI
}
```

效果：用户访问 `/fortune/2026-05-04`：
1. 0ms — RSC 渲染含 fallback reading 的页面
2. 50ms — 用户开始读 reading
3. ~3s — AI 后台生成完，router.refresh，第二次 RSC 渲染替换为个性化版本
4. 用户看到 reading "渐变"成更细致版本，**不闪烁**（React reconciliation 只更新 reading 文本节点）

### 3.4 不做什么

- **不做** AI 调用阻塞首屏（用户首次看会卡 2-3s）
- **不做** SSE 流式生成 reading（7 段非长文本，Stale-While-Revalidate 够用）
- **不做** 跨日 reading 预生成（cron 推荐做，**这是后续的 P1**）
- **不做** 改首页 `app/page.tsx`（首页不显示 reading，只展示 summary + attrs + launchers）

### 3.5 后续 P1（不在本次范围）

| 项 | 说明 | 优先级 |
|---|---|---|
| Cron 凌晨预生成所有活跃用户的当日 AI reading | 用户早起打开秒看到 AI 版（避免首次访问的 SWR 等待） | P1 |
| 周 / 月运势同样 AI 化 | 当前 fortunes_weekly / monthly 还没 reading 字段 | P2 |
| AI reading A/B 测试 | 给 5% 用户保留 fallback 看留存差异 | P3 |

---

## 4. 实施步骤（本次）

1. ✅ 写本文档（spec）
2. ⏳ schema 加 `reading_source` + `pnpm db:generate`
3. ⏳ 改 `fetch-today.ts` 透传 `readingSource`
4. ⏳ 新建 `/api/fortune/today/regenerate`
5. ⏳ 新建 `<ReadingAutoRegen />` 客户端组件
6. ⏳ 挂载到 `/fortune/[date]/page.tsx`
7. ⏳ `pnpm typecheck && pnpm test` 全过
8. ⏳ 手动验证 RSC + 客户端 SWR 链路

---

## 5. 验收标准

- [ ] 首次访问 `/fortune/2026-05-04`：fallback reading 渲染立即出现（<500ms）
- [ ] 1-3s 内 AI 版 reading 自动替换，**用户无需手动操作**
- [ ] 同日二次访问：直接显示 AI 版（命中 db 缓存）
- [ ] AI 失败时：fallback reading 不被破坏，正常显示
- [ ] 跑 `pnpm test` 1304 测试全过（不破现有）
- [ ] schema migration 自动 apply（重启 dev 后 fortunes_daily 多 reading_source 列）
