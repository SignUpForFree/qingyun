import { describe, it, expect } from "vitest";
import {
  pickSlip,
  SLIPS_MAX,
  drawSlip,
  pickWeighted,
  getSlip,
  BASE_WEIGHTS,
  DIVINATION_DIMS,
  adjustWeights,
} from "./slips";
import type { YongShenResult } from "@/lib/bazi/yong-shen";

const WEAK_YONG: YongShenResult = {
  gejuType: "身弱",
  yongShen: "水",
  jiShen: "土",
  strength: 22,
  reason: "身弱用印",
};
const STRONG_YONG: YongShenResult = {
  gejuType: "身强",
  yongShen: "土",
  jiShen: "水",
  strength: 80,
  reason: "身强用财",
};
const NEUTRAL_YONG: YongShenResult = {
  gejuType: "中和",
  yongShen: "金",
  jiShen: null,
  strength: 50,
  reason: "中和调候",
};

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
  it("BASE_WEIGHTS 总和 112（6 级：8+15+35+30+12+12）", () => {
    const sum = BASE_WEIGHTS.上上 + BASE_WEIGHTS.上吉 + BASE_WEIGHTS.吉 + BASE_WEIGHTS.平 + BASE_WEIGHTS.渐顺 + BASE_WEIGHTS.慎行;
    expect(sum).toBe(112);
  });

  it("1000 次抽样：吉 (W=35) 比慎行 (W=12) 命中频率高", () => {
    let ji = 0;
    let shenXing = 0;
    for (let i = 0; i < 1000; i++) {
      const n = pickWeighted(`seed-${i}`);
      const lvl = getSlip(n).level;
      if (lvl === "吉") ji++;
      else if (lvl === "慎行") shenXing++;
    }
    expect(ji).toBeGreaterThan(shenXing);
  });
});

describe("adjustWeights (M3.3 八字喜忌微调)", () => {
  it("无 yongShen → 返回 BASE 浅拷贝", () => {
    const r = adjustWeights(BASE_WEIGHTS);
    expect(r).toEqual(BASE_WEIGHTS);
    expect(r).not.toBe(BASE_WEIGHTS); // 浅拷贝
  });

  it("身弱（strength<30）→ 慎行 +5", () => {
    const r = adjustWeights(BASE_WEIGHTS, WEAK_YONG);
    expect(r.慎行).toBe(BASE_WEIGHTS.慎行 + 5);
    expect(r.吉).toBe(BASE_WEIGHTS.吉);
    expect(r.上吉).toBe(BASE_WEIGHTS.上吉);
  });

  it("身强（strength>70）→ 上吉/吉 +3", () => {
    const r = adjustWeights(BASE_WEIGHTS, STRONG_YONG);
    expect(r.上吉).toBe(BASE_WEIGHTS.上吉 + 3);
    expect(r.吉).toBe(BASE_WEIGHTS.吉 + 3);
    expect(r.慎行).toBe(BASE_WEIGHTS.慎行);
  });

  it("中和（30-70）→ 不调整", () => {
    const r = adjustWeights(BASE_WEIGHTS, NEUTRAL_YONG);
    expect(r).toEqual(BASE_WEIGHTS);
  });

  it("身弱 1000 次抽样：慎行命中频率比中和明显高", () => {
    let weakShenXing = 0;
    let neutralShenXing = 0;
    for (let i = 0; i < 1000; i++) {
      const wWeak = adjustWeights(BASE_WEIGHTS, WEAK_YONG);
      const wNeu = adjustWeights(BASE_WEIGHTS, NEUTRAL_YONG);
      if (getSlip(pickWeighted(`seed-weak-${i}`, wWeak)).level === "慎行") weakShenXing++;
      if (getSlip(pickWeighted(`seed-neu-${i}`, wNeu)).level === "慎行") neutralShenXing++;
    }
    expect(weakShenXing).toBeGreaterThan(neutralShenXing);
  });
});

describe("drawSlip 接 yongShen", () => {
  it("身弱 profile：相同输入下，weak vs no-yongshen 抽到的 slip 可能不同", () => {
    const argsBase = {
      profileId: "p1",
      date: "2026-04-27",
      question: "事业如何",
      category: "事业学业" as const,
    };
    const a = drawSlip({ ...argsBase });
    const b = drawSlip({ ...argsBase, yongShen: WEAK_YONG });
    // 各自确定性
    expect(drawSlip({ ...argsBase })).toEqual(a);
    expect(drawSlip({ ...argsBase, yongShen: WEAK_YONG })).toEqual(b);
    // 至少 a/b 任意一个能正常走通
    expect(a.slipNumber).toBeGreaterThan(0);
    expect(b.slipNumber).toBeGreaterThan(0);
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
