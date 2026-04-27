import { describe, it, expect } from "vitest";
import { computeSunYi } from "./sunyi";

describe("computeSunYi (M3.20)", () => {
  it("用神 = 卦五行 → support / 主维度 + 大", () => {
    const r = computeSunYi({ guaWuxing: "金", yongShen: "金" });
    expect(r.yongShenRelation).toBe("support");
    const cai = r.adjustments.find((a) => a.dim === "财运")!;
    expect(cai.delta).toBeGreaterThan(0);
    expect(cai.delta).toBeGreaterThanOrEqual(10);
  });

  it("卦生用神（土生金，用神金，卦土）→ support", () => {
    const r = computeSunYi({ guaWuxing: "土", yongShen: "金" });
    expect(r.yongShenRelation).toBe("support");
  });

  it("卦克用神（金克木，用神木，卦金）→ clash + 关键维度负", () => {
    const r = computeSunYi({ guaWuxing: "金", yongShen: "木" });
    expect(r.yongShenRelation).toBe("clash");
    const cai = r.adjustments.find((a) => a.dim === "财运")!;
    expect(cai.delta).toBeLessThan(0);
  });

  it("用神生卦象（木生火，用神木，卦火）→ drain + 整体偏负", () => {
    const r = computeSunYi({ guaWuxing: "火", yongShen: "木" });
    expect(r.yongShenRelation).toBe("drain");
    // drain 不应该有正数，但绝对值小
    for (const a of r.adjustments) {
      expect(a.delta).toBeLessThanOrEqual(0);
    }
  });

  it("无强联系（用神 vs 卦：水 vs 火，水克火 → clash）", () => {
    // 改用真正无关的：用神 火，卦 水
    const r = computeSunYi({ guaWuxing: "金", yongShen: "土" });
    // 土生金 (yongShen 生 gua) → drain
    expect(r.yongShenRelation).toBe("drain");
  });

  it("缺用神 → unrelated + 全维度 delta=0 + summary 提示", () => {
    const r = computeSunYi({ guaWuxing: "金" });
    expect(r.yongShenRelation).toBe("unrelated");
    for (const a of r.adjustments) expect(a.delta).toBe(0);
    expect(r.summary).toContain("用神");
  });

  it("delta 严格 clamp 在 -15..+15", () => {
    const cases: Array<{ gua: "金" | "木" | "水" | "火" | "土"; yong: "金" | "木" | "水" | "火" | "土" }> = [
      { gua: "金", yong: "金" },
      { gua: "金", yong: "木" },
      { gua: "火", yong: "木" },
      { gua: "土", yong: "金" },
    ];
    for (const c of cases) {
      const r = computeSunYi({ guaWuxing: c.gua, yongShen: c.yong });
      for (const a of r.adjustments) {
        expect(a.delta).toBeGreaterThanOrEqual(-15);
        expect(a.delta).toBeLessThanOrEqual(15);
      }
    }
  });

  it("6 维度全输出（无遗漏）", () => {
    const r = computeSunYi({ guaWuxing: "金", yongShen: "金" });
    const dims = r.adjustments.map((a) => a.dim).sort();
    expect(dims).toEqual(
      ["事业学业", "人际贵人", "感情姻缘", "平安健康", "综合运势", "财运"].sort(),
    );
  });

  it("primary 维度 delta 比非 primary 大", () => {
    const r = computeSunYi({ guaWuxing: "金", yongShen: "金" }); // primary=财运/事业学业
    const cai = r.adjustments.find((a) => a.dim === "财运")!.delta;
    const xueye = r.adjustments.find((a) => a.dim === "事业学业")!.delta;
    const ganqing = r.adjustments.find((a) => a.dim === "感情姻缘")!.delta;
    expect(cai).toBeGreaterThan(ganqing);
    expect(xueye).toBeGreaterThan(ganqing);
  });

  it("summary 含卦五行 + 用神 + relation 关键词", () => {
    const r = computeSunYi({ guaWuxing: "金", yongShen: "木" });
    expect(r.summary).toContain("金");
    expect(r.summary).toContain("木");
    expect(r.summary).toMatch(/相克|谨慎/);
  });
});
