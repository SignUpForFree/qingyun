# `lib/divination/` — 抽签 / 梅花易数 / 解梦算法库

**性质**：纯函数算法库，无 IO / 无 DB / 无 server-only。

> 上层业务请优先走 `@/lib/divination-providers` 的 `MeihuaProvider`（梅花）抽象，方便未来切换到第三方 API 实现而不修改业务代码。
>
> 抽签 / 解梦目前实现简单，暂不抽 Provider 层；上线后若发现需要切换再加。

## 模块概览

| 文件 | 职责 |
|---|---|
| `slips.ts` | 抽签随机权重 + 100 签数据加载 + drawSlip 主入口 |
| `slip-level.ts` | 签级别（上上/上吉/吉/平/渐顺/慎行）规范化映射 |
| `meihua-v2.ts` | 梅花易数 V2 主入口（5 卦推演 + 体用 + 时辰能量 + 五行损益 + 应期 + 64 卦字典） |
| `time-energy.ts` | 时辰能量场（按时辰地支与卦五行 + 用神匹配评估对齐度） |
| `sunyi.ts` | 五行损益（卦五行 vs 用神：补/泄/生/克四象限评分） |
| `dream-parser.ts` | 解梦输入校验 + 情绪映射（fast / precise 两模式共用） |

## 核心入口

### 抽签

```ts
import { drawSlip } from "@/lib/divination";

const result = drawSlip({
  dim: "财运",        // 维度
  seed: "user-uuid",  // 决定权重的种子（同种子结果稳定）
});
console.log(result.slip);   // SlipFull：number / level / poem / meaning
console.log(result.level);  // 规范化后的级别
```

### 梅花易数

```ts
import { meihuaV2 } from "@/lib/divination";

const r = meihuaV2({
  numbers: [123, 456, 789],
  hourBranch: "辰",
  userQuestion: "近期事业",
  profile: { id, gender, birth_date, birth_time, bazi_pillars },
});
console.log(r.ben, r.hu, r.bian);
console.log(r.tiYong, r.yingQi, r.timeEnergy, r.sunYi);
console.log(r.benDict, r.huDict, r.bianDict);
```

### 解梦

```ts
import { dreamInputSchema, buildEmotionHint } from "@/lib/divination";

const parsed = dreamInputSchema.parse({ scene, emotion: "焦虑" });
const hint = buildEmotionHint(parsed.emotion);
// hint 直接拼到 prompt 里
```

## 设计约束

1. **纯函数 / 可重放**：同输入必出同输出（除随机抽签外，且抽签可注入 seed）
2. **不抛业务错误**：缺字段补默认；调用方决定是否提示
3. **不依赖 server-only**：`@/db/seed/gua64` 是 const 数据，不在运行时读 DB
4. **不感知 AI**：算法层只产生结构化结果；prompt 拼装在 `lib/ai/prompts/*.ts`

## 测试

```bash
pnpm test lib/divination
```

每个核心文件都有对应 `*.test.ts`。

## 未来切第三方 API

实现 `@/lib/divination-providers/meihua.ts` 中 `RemoteApiMeihuaProvider`（已留占位），并在 env 设 `MEIHUA_PROVIDER=api`。返回需映射到 `MeihuaV2Result` 同形态。
