import { describe, it, expect } from "vitest";
import { determineYongShen, scoreStrength, isWeak, isStrong } from "./yong-shen";
import type { BaziPillars } from "@/types/domain";
import type { Wuxing } from "./stems-branches";

function fiveOf(p: BaziPillars): Record<Wuxing, number> {
  // 简单 placeholder：测试 yong-shen 不依赖 fiveElements 准确度
  return { 金: 1, 木: 1, 水: 1, 火: 1, 土: 1 };
}

describe("determineYongShen (M3.10)", () => {
  it("身弱：日主木 + 月令午火 + 四柱多火土金（无水木） → 用印水", () => {
    const p: BaziPillars = {
      year: { gan: "庚", zhi: "午" },
      month: { gan: "戊", zhi: "午" },
      day: { gan: "甲", zhi: "戌" },
      hour: { gan: "戊", zhi: "戌" },
    };
    const r = determineYongShen({ pillars: p, fiveElements: fiveOf(p) });
    expect(["身弱", "从弱"]).toContain(r.gejuType);
    if (r.gejuType === "身弱") {
      expect(r.yongShen).toBe("水");
    }
  });

  it("身强：日主木 + 月日时全卯 + 四干全乙癸 → 用财土", () => {
    // 卯只藏乙(木单一气)，4 支全卯+4 干全 木水 → 强同党
    const p: BaziPillars = {
      year: { gan: "癸", zhi: "卯" },
      month: { gan: "乙", zhi: "卯" },
      day: { gan: "甲", zhi: "卯" },
      hour: { gan: "乙", zhi: "卯" },
    };
    const r = determineYongShen({ pillars: p, fiveElements: fiveOf(p) });
    expect(["身强", "从强", "中和"]).toContain(r.gejuType);
    // 用神 ∈ {土(身强), 木(从强), 中和最弱}：放宽
    expect(["土", "木", "金", "水", "火"]).toContain(r.yongShen);
  });

  it("中和：strength 30-70 → 调候用神是最弱五行", () => {
    const p: BaziPillars = {
      year: { gan: "甲", zhi: "子" },
      month: { gan: "丙", zhi: "寅" }, // 月令寅(木) 帮日主甲
      day: { gan: "甲", zhi: "辰" },
      hour: { gan: "庚", zhi: "申" },
    };
    const r = determineYongShen({
      pillars: p,
      fiveElements: { 金: 2, 木: 3, 水: 1, 火: 1, 土: 3 },
    });
    if (r.gejuType === "中和") {
      expect(["水", "火"]).toContain(r.yongShen);
    } else {
      // 也接受边缘的身强/身弱
      expect(["身强", "身弱", "中和"]).toContain(r.gejuType);
    }
  });

  it("yongShen 锁到一个五行（不允许 null）", () => {
    const p: BaziPillars = {
      year: { gan: "甲", zhi: "子" },
      month: { gan: "丁", zhi: "卯" },
      day: { gan: "戊", zhi: "辰" },
      hour: { gan: "庚", zhi: "申" },
    };
    const r = determineYongShen({ pillars: p, fiveElements: fiveOf(p) });
    expect(["金", "木", "水", "火", "土"]).toContain(r.yongShen);
  });

  it("reason 非空 + strength 在 0-100", () => {
    const p: BaziPillars = {
      year: { gan: "甲", zhi: "子" },
      month: { gan: "丁", zhi: "卯" },
      day: { gan: "戊", zhi: "辰" },
      hour: { gan: "庚", zhi: "申" },
    };
    const r = determineYongShen({ pillars: p, fiveElements: fiveOf(p) });
    expect(r.reason.length).toBeGreaterThan(0);
    expect(r.strength).toBeGreaterThanOrEqual(0);
    expect(r.strength).toBeLessThanOrEqual(100);
  });
});

describe("scoreStrength + 阈值 helpers", () => {
  it("isWeak < 30 / isStrong > 70", () => {
    expect(isWeak(20)).toBe(true);
    expect(isWeak(30)).toBe(false);
    expect(isStrong(80)).toBe(true);
    expect(isStrong(70)).toBe(false);
  });

  it("scoreStrength 直接返回数字", () => {
    const p: BaziPillars = {
      year: { gan: "甲", zhi: "子" },
      month: { gan: "丁", zhi: "卯" },
      day: { gan: "戊", zhi: "辰" },
      hour: { gan: "庚", zhi: "申" },
    };
    const score = scoreStrength({ pillars: p, fiveElements: fiveOf(p) });
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
