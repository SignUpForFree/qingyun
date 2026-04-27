import { describe, it, expect } from "vitest";
import {
  pickSlip,
  SLIPS_MAX,
  drawSlip,
  pickWeighted,
  getSlip,
  BASE_WEIGHTS,
  DIVINATION_DIMS,
} from "./slips";

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
    // 60 次抽样应至少覆盖 15 个不同号（SLIPS_MAX=100 时更容易）
    expect(set.size).toBeGreaterThan(15);
  });

  it("自定义 max", () => {
    const r = pickSlip({ seed: "test", max: 5 });
    expect(r.number).toBeGreaterThanOrEqual(1);
    expect(r.number).toBeLessThanOrEqual(5);
  });
});

describe("drawSlip (M3.2)", () => {
  it("同 (profileId, date, question, category) → 相同 slipNumber", () => {
    const a = drawSlip({
      profileId: "p-1",
      date: "2026-04-27",
      question: "事业",
      category: "事业学业",
    });
    const b = drawSlip({
      profileId: "p-1",
      date: "2026-04-27",
      question: "事业",
      category: "事业学业",
    });
    expect(a.slipNumber).toBe(b.slipNumber);
    expect(a.slip.number).toBe(b.slip.number);
    expect(a.dimensionReading).toBe(b.dimensionReading);
  });

  it("不同 category 通常给不同 slipNumber（同 user/date/question）", () => {
    const a = drawSlip({
      profileId: "p-1",
      date: "2026-04-27",
      question: "Q",
      category: "事业学业",
    });
    const b = drawSlip({
      profileId: "p-1",
      date: "2026-04-27",
      question: "Q",
      category: "感情姻缘",
    });
    // 不强保证不同，但 sha256 离散性很大概率不同
    expect(a.slipNumber === b.slipNumber).toBe(false);
  });

  it("slipNumber 在 1-100", () => {
    for (let i = 0; i < 20; i++) {
      const d = drawSlip({
        profileId: `p-${i}`,
        date: "2026-04-27",
        question: "?",
        category: "综合运势",
      });
      expect(d.slipNumber).toBeGreaterThanOrEqual(1);
      expect(d.slipNumber).toBeLessThanOrEqual(100);
    }
  });

  it("dimensionReading 等于 slip.categoryReadings[category]", () => {
    const d = drawSlip({
      profileId: "p-1",
      date: "2026-04-27",
      question: "Q",
      category: "财运",
    });
    expect(d.dimensionReading).toBe(d.slip.categoryReadings["财运"]);
  });

  it("覆盖所有 6 个维度都能拿到非空 reading", () => {
    for (const dim of DIVINATION_DIMS) {
      const d = drawSlip({
        profileId: "p-1",
        date: "2026-04-27",
        question: "Q",
        category: dim,
      });
      expect(d.dimensionReading.length).toBeGreaterThan(0);
    }
  });
});

describe("pickWeighted 分布", () => {
  it("BASE_WEIGHTS 总和 100（5 级总数）", () => {
    const sum = BASE_WEIGHTS.上上 + BASE_WEIGHTS.上吉 + BASE_WEIGHTS.中吉 + BASE_WEIGHTS.中平 + BASE_WEIGHTS.下下;
    expect(sum).toBe(100);
  });

  it("1000 次抽样：中吉 (W=35) 比下下 (W=12) 命中频率高", () => {
    let zhongJi = 0;
    let xiaXia = 0;
    for (let i = 0; i < 1000; i++) {
      const n = pickWeighted(`seed-${i}`);
      const lvl = getSlip(n).level;
      if (lvl === "中吉") zhongJi++;
      else if (lvl === "下下") xiaXia++;
    }
    expect(zhongJi).toBeGreaterThan(xiaXia);
  });
});

describe("getSlip", () => {
  it("第 1 签 = 心定福自来 / 上上", () => {
    const s = getSlip(1);
    expect(s.title).toBe("心定福自来");
    expect(s.level).toBe("上上");
    expect(s.poemLines.length).toBeLessThanOrEqual(4);
  });

  it("不存在签号抛错", () => {
    expect(() => getSlip(999)).toThrow();
  });
});
