# `lib/bazi/` — 八字排盘算法库

**性质**：纯函数算法库，无 IO / 无 DB / 无 server-only。任何 runtime（API route、cron、worker、单测）都可以直接 import。

> 上层业务请优先走 `@/lib/divination-providers/bazi` 的 `BaziProvider` 抽象，方便未来切换到第三方 API 实现而不修改业务代码。

## 模块概览

| 文件 | 职责 |
|---|---|
| `chart.ts` | `buildChartV2(input, { centerYear })` 主入口；返回完整命盘（四柱 / 五行 / 十神 / 神煞 / 大运 / 流年 / 用神） |
| `stems-branches.ts` | 天干地支 / 五行 / 十神映射 + 合冲会等基本关系 |
| `solar-time.ts` | `toSolarTrueTime(t, longitude)` 真太阳时校正（按经度） |
| `shensha-rules.ts` | 30+ 神煞规则表 + 匹配函数 + 按维度过滤 |
| `dayun.ts` | 大运 8 步 + 流年 5 年 |
| `yong-shen.ts` | 身强身弱判定 + 用神选取 |
| `today.ts` | 当日日柱（fortune 计算用） |

## 核心入口

```ts
import { buildChartV2 } from "@/lib/bazi";

const chart = buildChartV2(
  {
    birthTime: new Date("1995-03-22T09:00:00+08:00"),
    longitude: 121.47,
    latitude: 31.23,
    gender: "female",
    calendarType: "solar",
  },
  { centerYear: 2026 },
);

console.log(chart.pillars);     // { year, month, day, hour }
console.log(chart.dayMaster);   // 日主天干
console.log(chart.fiveElements); // { 金, 木, 水, 火, 土 }
console.log(chart.luckPillars); // 大运 8 步
console.log(chart.liunian);     // 流年 5 年（centerYear ± 2）
console.log(chart.shensha);     // 命中神煞
console.log(chart.yongShen);    // 用神
```

## 设计约束

1. **纯函数**：不读 DB、不写文件、不调 fetch。任何"今天日期"都通过参数传入。
2. **不抛业务错误**：缺字段时填合理默认（如缺 longitude 用 121.47），由上层决定是否提示用户。
3. **真太阳时优先**：`buildChartV2` 内部一定先做 `toSolarTrueTime`，避免边界时辰错位。
4. **dependencies**：`lunar-javascript` 唯一三方包；其余全部本地实现。

## 测试

```bash
pnpm test lib/bazi
```

每个核心文件均有对应 `*.test.ts`，覆盖：

- 干支映射 / 五行映射 / 十神判定
- 真太阳时偏移（±60min）
- 30+ 神煞各自命中条件
- 大运起运算法（出生 → 月柱顺逆排）
- 用神身强身弱不同剧本

## 未来切第三方 API

实现 `@/lib/divination-providers/bazi.ts` 中 `RemoteApiBaziProvider`（已留占位），并在 env 设 `BAZI_PROVIDER=api`。注意：

- 第三方返回需映射到本库 `BaziChartV2` 同形态（pillars / dayMaster / fiveElements / luckPillars / shensha / yongShen），缺字段直接抛错，让上层降级
- 本地算法保留作为兜底（dev / 单测）
