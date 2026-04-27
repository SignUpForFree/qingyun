import { describe, it, expect } from "vitest";
import {
  SHENSHA_RULES,
  matchShensha,
  detectAllShensha,
  detectShenshaByDim,
} from "./shensha-rules";
import type { BaziPillars } from "@/types/domain";
import type { Stem, Branch } from "./stems-branches";

function pillars(
  yg: Stem, yz: Branch,
  mg: Stem, mz: Branch,
  dg: Stem, dz: Branch,
  hg: Stem, hz: Branch,
): BaziPillars {
  return {
    year: { gan: yg, zhi: yz },
    month: { gan: mg, zhi: mz },
    day: { gan: dg, zhi: dz },
    hour: { gan: hg, zhi: hz },
  };
}

describe("SHENSHA_RULES 总览", () => {
  it("规则总数 30+", () => {
    expect(SHENSHA_RULES.length).toBeGreaterThanOrEqual(30);
  });

  it("每条 rule 含 name/match/interpretation/categories/polarity", () => {
    for (const r of SHENSHA_RULES) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(typeof r.match).toBe("function");
      expect(r.interpretation.length).toBeGreaterThan(0);
      expect(r.categories.length).toBeGreaterThan(0);
      expect(["吉", "凶", "中"]).toContain(r.polarity);
    }
  });

  it("规则名唯一", () => {
    const names = SHENSHA_RULES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("matchShensha 正例 + 反例 (30+ shensha × 2)", () => {
  // ============ 1-2 天乙贵人 ============
  it("天乙贵人：甲日见丑 → true", () => {
    const p = pillars("丙", "寅", "丁", "丑", "甲", "子", "庚", "午");
    expect(matchShensha("天乙贵人", p)).toBe(true);
  });
  it("天乙贵人：甲日不见丑/未 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("天乙贵人", p)).toBe(false);
  });

  // ============ 3-4 文昌 ============
  it("文昌：甲日见巳 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "巳", "庚", "午");
    expect(matchShensha("文昌", p)).toBe(true);
  });
  it("文昌：甲日不见巳 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("文昌", p)).toBe(false);
  });

  // ============ 5-6 桃花 ============
  it("桃花：年支寅见卯 → true（寅午戌见卯）", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("桃花", p)).toBe(true);
  });
  it("桃花：年支寅且四柱无卯 → false", () => {
    const p = pillars("丙", "寅", "丁", "丑", "甲", "子", "庚", "午");
    expect(matchShensha("桃花", p)).toBe(false);
  });

  // ============ 7-8 驿马 ============
  it("驿马：年支寅见申 → true（寅午戌见申）", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("驿马", p)).toBe(true);
  });
  it("驿马：年支寅 + 日支戌 + 四柱均不见申 → false", () => {
    // 年寅 + 日戌 都属寅午戌组 → yima=申；只要四柱无申即可
    const p = pillars("丙", "寅", "丁", "卯", "甲", "戌", "乙", "丑");
    expect(matchShensha("驿马", p)).toBe(false);
  });

  // ============ 9-10 华盖 ============
  it("华盖：年支子见辰 → true（申子辰见辰）", () => {
    const p = pillars("丙", "子", "丁", "辰", "甲", "申", "庚", "午");
    expect(matchShensha("华盖", p)).toBe(true);
  });
  it("华盖：年支子且四柱无辰 → false", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("华盖", p)).toBe(false);
  });

  // ============ 11-12 将星 ============
  it("将星：年支寅见午 → true（寅午戌见午）", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("将星", p)).toBe(true);
  });
  it("将星：年支寅且四柱无午 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "申", "乙", "丑");
    expect(matchShensha("将星", p)).toBe(false);
  });

  // ============ 13-14 红鸾 ============
  it("红鸾：年支子见卯 → true", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("红鸾", p)).toBe(true);
  });
  it("红鸾：年支子且四柱无卯 → false", () => {
    const p = pillars("丙", "子", "丁", "丑", "甲", "申", "庚", "午");
    expect(matchShensha("红鸾", p)).toBe(false);
  });

  // ============ 15-16 天喜 ============
  it("天喜：年支子见酉 → true", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "酉", "庚", "午");
    expect(matchShensha("天喜", p)).toBe(true);
  });
  it("天喜：年支子且四柱无酉 → false", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("天喜", p)).toBe(false);
  });

  // ============ 17-18 太极贵人 ============
  it("太极贵人：甲日见子 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("太极贵人", p)).toBe(true);
  });
  it("太极贵人：甲日不见子/午 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "申", "乙", "丑");
    expect(matchShensha("太极贵人", p)).toBe(false);
  });

  // ============ 19-20 天德 ============
  it("天德：寅月四柱见丁 → true", () => {
    const p = pillars("丙", "子", "丁", "寅", "甲", "申", "庚", "午");
    expect(matchShensha("天德", p)).toBe(true);
  });
  it("天德：寅月四柱无丁 → false", () => {
    const p = pillars("丙", "子", "丙", "寅", "甲", "申", "庚", "午");
    expect(matchShensha("天德", p)).toBe(false);
  });

  // ============ 21-22 月德 ============
  it("月德：寅月四柱见丙 → true（寅午戌月见丙）", () => {
    const p = pillars("丙", "子", "丁", "寅", "甲", "申", "庚", "午");
    expect(matchShensha("月德", p)).toBe(true);
  });
  it("月德：寅月四柱无丙 → false", () => {
    const p = pillars("丁", "子", "丁", "寅", "甲", "申", "庚", "午");
    expect(matchShensha("月德", p)).toBe(false);
  });

  // ============ 23-24 学堂 ============
  it("学堂：甲日见亥 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "亥", "庚", "午");
    expect(matchShensha("学堂", p)).toBe(true);
  });
  it("学堂：甲日不见亥 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("学堂", p)).toBe(false);
  });

  // ============ 25-26 国印 ============
  it("国印：甲日见戌 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "戌", "庚", "午");
    expect(matchShensha("国印", p)).toBe(true);
  });
  it("国印：甲日不见戌 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("国印", p)).toBe(false);
  });

  // ============ 27-28 金舆 ============
  it("金舆：甲日见辰 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "辰", "庚", "午");
    expect(matchShensha("金舆", p)).toBe(true);
  });
  it("金舆：甲日不见辰 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("金舆", p)).toBe(false);
  });

  // ============ 29-30 福星 ============
  it("福星：甲日见寅 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("福星", p)).toBe(true);
  });
  it("福星：甲日不见寅 → false", () => {
    const p = pillars("丙", "巳", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("福星", p)).toBe(false);
  });

  // ============ 31-32 三奇 ============
  it("三奇：甲戊庚 全见 → true", () => {
    const p = pillars("甲", "寅", "戊", "卯", "庚", "子", "庚", "午");
    expect(matchShensha("三奇", p)).toBe(true);
  });
  it("三奇：仅甲戊（缺庚）→ false", () => {
    const p = pillars("甲", "寅", "戊", "卯", "丁", "子", "丙", "午");
    expect(matchShensha("三奇", p)).toBe(false);
  });

  // ============ 33-34 禄神 ============
  it("禄神：甲日见寅 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("禄神", p)).toBe(true);
  });
  it("禄神：甲日不见寅 → false", () => {
    const p = pillars("丙", "巳", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("禄神", p)).toBe(false);
  });

  // ============ 35-36 羊刃 ============
  it("羊刃：甲日见卯 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("羊刃", p)).toBe(true);
  });
  it("羊刃：甲日不见卯 → false", () => {
    const p = pillars("丙", "寅", "丁", "辰", "甲", "子", "庚", "午");
    expect(matchShensha("羊刃", p)).toBe(false);
  });

  // ============ 37-38 飞刃 ============
  it("飞刃：甲日见酉 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "酉", "庚", "午");
    expect(matchShensha("飞刃", p)).toBe(true);
  });
  it("飞刃：甲日不见酉 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("飞刃", p)).toBe(false);
  });

  // ============ 39-40 劫煞 ============
  it("劫煞：年支寅见亥 → true（寅午戌见亥）", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "亥", "庚", "午");
    expect(matchShensha("劫煞", p)).toBe(true);
  });
  it("劫煞：年支寅四柱无亥 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("劫煞", p)).toBe(false);
  });

  // ============ 41-42 灾煞 ============
  it("灾煞：年支寅见子 → true（寅午戌见子）", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("灾煞", p)).toBe(true);
  });
  it("灾煞：年支寅四柱无子 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "亥", "庚", "午");
    expect(matchShensha("灾煞", p)).toBe(false);
  });

  // ============ 43-44 元辰 ============
  it("元辰：年支子见未 → true", () => {
    const p = pillars("丙", "子", "丁", "未", "甲", "申", "庚", "午");
    expect(matchShensha("元辰", p)).toBe(true);
  });
  it("元辰：年支子四柱无未 → false", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("元辰", p)).toBe(false);
  });

  // ============ 45-46 孤辰 ============
  it("孤辰：年支子见寅 → true", () => {
    const p = pillars("丙", "子", "丁", "寅", "甲", "申", "庚", "午");
    expect(matchShensha("孤辰", p)).toBe(true);
  });
  it("孤辰：年支子四柱无寅 → false", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("孤辰", p)).toBe(false);
  });

  // ============ 47-48 寡宿 ============
  it("寡宿：年支子见戌 → true", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "戌", "庚", "午");
    expect(matchShensha("寡宿", p)).toBe(true);
  });
  it("寡宿：年支子四柱无戌 → false", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("寡宿", p)).toBe(false);
  });

  // ============ 49-50 阴阳差错 ============
  it("阴阳差错：日柱丙子 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "丙", "子", "庚", "午");
    expect(matchShensha("阴阳差错", p)).toBe(true);
  });
  it("阴阳差错：日柱甲子 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("阴阳差错", p)).toBe(false);
  });

  // ============ 51-52 童子煞 ============
  it("童子煞：年支子 → true", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("童子煞", p)).toBe(true);
  });
  it("童子煞：年支寅 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("童子煞", p)).toBe(false);
  });

  // ============ 53-54 流霞 ============
  it("流霞：甲日见酉 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "酉", "庚", "午");
    expect(matchShensha("流霞", p)).toBe(true);
  });
  it("流霞：甲日不见酉 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("流霞", p)).toBe(false);
  });

  // ============ 55-56 亡神 ============
  it("亡神：年支子见亥 → true", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "亥", "庚", "午");
    expect(matchShensha("亡神", p)).toBe(true);
  });
  it("亡神：年支子四柱无亥 → false", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "申", "庚", "午");
    expect(matchShensha("亡神", p)).toBe(false);
  });

  // ============ 57-58 隔角 ============
  it("隔角：日支寅见巳 → true", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "寅", "庚", "巳");
    expect(matchShensha("隔角", p)).toBe(true);
  });
  it("隔角：日支寅四柱无巳 → false", () => {
    const p = pillars("丙", "子", "丁", "卯", "甲", "寅", "庚", "午");
    expect(matchShensha("隔角", p)).toBe(false);
  });

  // ============ 59-60 十恶大败 ============
  it("十恶大败：日柱甲辰 → true", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "辰", "庚", "午");
    expect(matchShensha("十恶大败", p)).toBe(true);
  });
  it("十恶大败：日柱甲子 → false", () => {
    const p = pillars("丙", "寅", "丁", "卯", "甲", "子", "庚", "午");
    expect(matchShensha("十恶大败", p)).toBe(false);
  });
});

describe("detectAllShensha + detectShenshaByDim", () => {
  it("detectAllShensha 返回所有命中", () => {
    const p = pillars("甲", "寅", "戊", "卯", "庚", "子", "庚", "午");
    const hits = detectAllShensha(p);
    expect(hits.length).toBeGreaterThan(0);
    // 三奇 (甲戊庚) 应当命中
    expect(hits.some((r) => r.name === "三奇")).toBe(true);
  });

  it("detectShenshaByDim('感情姻缘') 仅返回包含该 dim 的", () => {
    const p = pillars("甲", "子", "丁", "卯", "甲", "酉", "庚", "午"); // 子年红鸾=卯/天喜=酉
    const r = detectShenshaByDim(p, "感情姻缘");
    for (const rule of r) {
      expect(rule.categories).toContain("感情姻缘");
    }
  });
});
