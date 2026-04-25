# 八字测试用例

> **用途**：`lib/bazi` 单测的 ground truth。
>
> **P1 阶段策略（2026-04-26）**：仅要求 lunar-javascript 自洽（输出结构完整 + 字段类型正确 + 五行配比合法 + 大运 8 步），用作回归基线。严格的"权威 App 校对"等用户后补到 W2 末或 P2 期间，期间 case 2/3 单测使用 `it.skip` 占位。
>
> **升级路径**：用户提供权威 App 排盘后，把外部 App 真实排盘填入 `expected.*`，C5 单测改为严格相等，并把 `it.skip` 改为 `it`。

---

## 案例 1（self-consistency baseline，P1 必须通过）

| 字段 | 值 |
|---|---|
| 输入·公历 | 1990-06-15 14:30 |
| 输入·性别 | 男 |
| 输入·地点 | 杭州 |
| 经度 | 120.1551 |
| 纬度 | 30.2741 |

**P1 断言（lunar-javascript 自洽）**：

- `chart.pillars.year/month/day/hour` 各有 `gan` ∈ 10 天干，`zhi` ∈ 12 地支
- `chart.dayMaster` ∈ 10 天干（即 day pillar 的 gan）
- `chart.fiveElements` 5 项总和 = 8（4 柱 × 2 字 = 8 个五行属性的累计）
- `chart.tenGods` 含 4 项（年/月/时干对日干 + 时干对日干 = 4 个十神，日干自身用 "日主"）
- `chart.luck` 大运 8 步，每步 10 年，含 `gan`/`zhi`/`startAge`

**升级后断言（待用户提供）**：

- 真太阳时偏差：约 +1 分钟（杭州 lng 120.16，离 120 仅差 0.16°）
- 四柱：庚午年 / 壬午月 / 戊辰日 / 己未时（待权威 App 校对）
- 五行：金 1 木 0 水 1 火 4 土 4（待权威 App 校对）
- 日主：戊（土）
- 校对来源：八字精批 App + 网易五行排盘 ×2 验证

---

## 案例 2：早晨边界（农历转换） · TBD

| 字段 | 值 |
|---|---|
| 输入·农历 | 2000-01-01 06:00 |
| 输入·性别 | 女 |
| 输入·地点 | 上海 |
| 经度 | 121.4737 |
| 纬度 | 31.2304 |

- **状态**：P1 `it.skip`，等用户提供权威排盘后启用
- **预期重点**：农历→公历转换正确性 + 早晨时辰边界（卯时 vs 辰时）

---

## 案例 3：跨夜子时（最容易出错） · TBD

| 字段 | 值 |
|---|---|
| 输入·公历 | 1985-12-31 23:45 |
| 输入·性别 | 男 |
| 输入·地点 | 北京 |
| 经度 | 116.4074 |
| 纬度 | 39.9042 |

- **状态**：P1 `it.skip`，等用户提供权威排盘后启用
- **风险**：日柱用第二天还是当天？lunar-javascript 默认规则 vs 外部 App 可能分歧
- **关键验证**：23:00-00:59 的子时归属（古法 vs 今法）

---

## 自洽断言函数（C5 用）

```ts
function assertSelfConsistent(chart: BaziChart) {
  // 1. 四柱完整
  for (const p of [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]) {
    expect(TEN_GANS).toContain(p.gan);
    expect(TWELVE_ZHIS).toContain(p.zhi);
  }
  // 2. 日主
  expect(chart.dayMaster).toBe(chart.pillars.day.gan);
  // 3. 五行总和
  const total = Object.values(chart.fiveElements).reduce((a, b) => a + b, 0);
  expect(total).toBe(8);
  // 4. 大运 8 步
  expect(chart.luck).toHaveLength(8);
  for (const l of chart.luck) {
    expect(TEN_GANS).toContain(l.gan);
    expect(TWELVE_ZHIS).toContain(l.zhi);
    expect(l.startAge).toBeGreaterThanOrEqual(0);
  }
}
```
