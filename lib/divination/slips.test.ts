import { describe, it, expect } from "vitest";
import { pickSlip, SLIPS_MAX } from "./slips";

describe("pickSlip", () => {
  it("number 在 [1, MAX] 范围", () => {
    for (let i = 0; i < 100; i++) {
      const r = pickSlip();
      expect(r.number).toBeGreaterThanOrEqual(1);
      expect(r.number).toBeLessThanOrEqual(SLIPS_MAX);
    }
  });

  it("seed 决定结果（同 seed 同结果）", () => {
    const a = pickSlip({ seed: "user-abc-2026-04-26" });
    const b = pickSlip({ seed: "user-abc-2026-04-26" });
    expect(a.number).toBe(b.number);
  });

  it("不同 seed 多数情况下不同（统计性）", () => {
    const set = new Set<number>();
    for (let i = 0; i < 60; i++) set.add(pickSlip({ seed: `seed-${i}` }).number);
    // SLIPS_MAX = 30，60 次抽样应至少覆盖 15 个不同号
    expect(set.size).toBeGreaterThan(15);
  });

  it("自定义 max", () => {
    const r = pickSlip({ seed: "test", max: 5 });
    expect(r.number).toBeGreaterThanOrEqual(1);
    expect(r.number).toBeLessThanOrEqual(5);
  });
});
