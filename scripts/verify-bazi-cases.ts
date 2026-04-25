#!/usr/bin/env tsx
/**
 * 八字案例核对脚本
 *
 * 用法：
 *   pnpm tsx scripts/verify-bazi-cases.ts
 *
 * 输出 3 个标准案例的完整排盘 JSON，便于：
 *   1. P1 阶段：观察 lunar-javascript 自洽输出（已写到 bazi-test-cases.md）
 *   2. P2/P3 阶段：用户拿到权威 App 排盘后，diff 对照差异点
 */
import { buildChart } from "../lib/bazi/chart";
import type { BuildChartInput } from "../types/domain";

interface NamedCase {
  name: string;
  input: BuildChartInput;
}

const CASES: NamedCase[] = [
  {
    name: "案例 1 · 杭州 1990-06-15 14:30 男（公历）",
    input: {
      birthTime: new Date("1990-06-15T14:30:00+08:00"),
      longitude: 120.1551,
      latitude: 30.2741,
      gender: "male",
      calendarType: "solar",
    },
  },
  {
    name: "案例 2 · 上海农历 2000-01-01 06:00 女",
    input: {
      birthTime: new Date(2000, 0, 1, 6, 0, 0),
      longitude: 121.4737,
      latitude: 31.2304,
      gender: "female",
      calendarType: "lunar",
    },
  },
  {
    name: "案例 3 · 北京 1985-12-31 23:45 男（跨夜子时）",
    input: {
      birthTime: new Date("1985-12-31T23:45:00+08:00"),
      longitude: 116.4074,
      latitude: 39.9042,
      gender: "male",
      calendarType: "solar",
    },
  },
];

function main() {
  for (const c of CASES) {
    process.stdout.write(`\n=== ${c.name} ===\n`);
    const chart = buildChart(c.input);
    process.stdout.write(JSON.stringify(chart, null, 2));
    process.stdout.write("\n");
  }
}

main();
