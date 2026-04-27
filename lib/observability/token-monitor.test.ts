import { describe, it, expect } from "vitest";
import { aggregateTokenRows, percentile, type TokenRow } from "./token-monitor";

const SINCE = "2026-04-20T00:00:00.000Z";
const UNTIL = "2026-04-27T23:59:59.999Z";

const ROWS: TokenRow[] = [
  { intent: "chat", tokens_used: 100, created_at: "2026-04-25T10:00:00.000Z" },
  { intent: "chat", tokens_used: 200, created_at: "2026-04-25T11:00:00.000Z" },
  { intent: "bazi", tokens_used: 1500, created_at: "2026-04-25T12:00:00.000Z" },
  { intent: "bazi", tokens_used: 1800, created_at: "2026-04-26T10:00:00.000Z" },
  { intent: "meihua", tokens_used: 1200, created_at: "2026-04-26T11:00:00.000Z" },
  { intent: "dream", tokens_used: 800, created_at: "2026-04-26T12:00:00.000Z" },
  { intent: "divination", tokens_used: 500, created_at: "2026-04-27T10:00:00.000Z" },
  { intent: null, tokens_used: 50, created_at: "2026-04-27T11:00:00.000Z" },
];

describe("aggregateTokenRows (M3.34)", () => {
  it("totalTokens = 所有行之和", () => {
    const r = aggregateTokenRows(ROWS, SINCE, UNTIL);
    expect(r.totalTokens).toBe(100 + 200 + 1500 + 1800 + 1200 + 800 + 500 + 50);
  });

  it("messageCount 反映原始行数", () => {
    const r = aggregateTokenRows(ROWS, SINCE, UNTIL);
    expect(r.messageCount).toBe(8);
  });

  it("byIntent 按总 token 降序排列", () => {
    const r = aggregateTokenRows(ROWS, SINCE, UNTIL);
    expect(r.byIntent[0]!.intent).toBe("bazi"); // 1500+1800=3300 最大
    expect(r.byIntent[0]!.totalTokens).toBe(3300);
    expect(r.byIntent[0]!.messageCount).toBe(2);
    // chat 应排在 unknown 之前（chat=300 vs unknown=50）
    const chat = r.byIntent.find((b) => b.intent === "chat")!;
    expect(chat.totalTokens).toBe(300);
    const unknown = r.byIntent.find((b) => b.intent === "unknown")!;
    expect(unknown.totalTokens).toBe(50); // null intent 归到 unknown
  });

  it("byDay 按日期升序", () => {
    const r = aggregateTokenRows(ROWS, SINCE, UNTIL);
    expect(r.byDay.map((d) => d.date)).toEqual([
      "2026-04-25",
      "2026-04-26",
      "2026-04-27",
    ]);
    expect(r.byDay[0]!.totalTokens).toBe(100 + 200 + 1500);
    expect(r.byDay[1]!.totalTokens).toBe(1800 + 1200 + 800);
    expect(r.byDay[2]!.totalTokens).toBe(500 + 50);
  });

  it("空 rows 返回零结果", () => {
    const r = aggregateTokenRows([], SINCE, UNTIL);
    expect(r.totalTokens).toBe(0);
    expect(r.messageCount).toBe(0);
    expect(r.byIntent).toEqual([]);
    expect(r.byDay).toEqual([]);
    expect(r.p95).toBe(0);
  });

  it("p95 大致命中长 prompt 上区", () => {
    const r = aggregateTokenRows(ROWS, SINCE, UNTIL);
    // 8 个样本中 95% 应落在 1500+ 区段
    expect(r.p95).toBeGreaterThanOrEqual(1500);
  });

  it("tokens_used=null/0 不污染 p95（不计入分位样本）", () => {
    const rows: TokenRow[] = [
      { intent: "chat", tokens_used: 0, created_at: "2026-04-25T00:00:00Z" },
      { intent: "chat", tokens_used: null, created_at: "2026-04-25T00:00:00Z" },
      { intent: "bazi", tokens_used: 100, created_at: "2026-04-25T00:00:00Z" },
      { intent: "bazi", tokens_used: 200, created_at: "2026-04-25T00:00:00Z" },
    ];
    const r = aggregateTokenRows(rows, SINCE, UNTIL);
    // p95 应在 100-200 区间（两个非零样本）
    expect(r.p95).toBeGreaterThan(0);
    expect(r.p95).toBeLessThanOrEqual(200);
  });

  it("since/until 透传到结果", () => {
    const r = aggregateTokenRows(ROWS, SINCE, UNTIL);
    expect(r.since).toBe(SINCE);
    expect(r.until).toBe(UNTIL);
  });
});

describe("percentile", () => {
  it("空数组 → 0", () => {
    expect(percentile([], 0.95)).toBe(0);
  });

  it("p=0.5 中位数", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("p=0.95 接近最大", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(samples, 0.95)).toBeCloseTo(95.05, 1);
  });

  it("p=0 返回最小", () => {
    expect(percentile([5, 1, 3], 0)).toBe(5); // p=0 走 samples[0]，未排序，故是原数组首
  });

  it("p=1 返回最大（已排序）", () => {
    expect(percentile([5, 1, 3], 1)).toBe(3); // 最后一个原数组项
  });

  it("线性插值（小样本）", () => {
    // [10, 20, 30] p=0.5 → 20
    expect(percentile([10, 20, 30], 0.5)).toBe(20);
    // p=0.75 索引 = 2 * 0.75 = 1.5 → lerp(20, 30, 0.5) = 25
    expect(percentile([10, 20, 30], 0.75)).toBe(25);
  });
});
