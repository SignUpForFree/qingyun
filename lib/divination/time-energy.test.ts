import { describe, it, expect } from "vitest";
import { computeTimeEnergy } from "./time-energy";

describe("computeTimeEnergy (M3.19)", () => {
  it("子时 → 水旺 / dominantWuxing=水", () => {
    const r = computeTimeEnergy({ hourBranch: "子", guaWuxing: "水" });
    expect(r.dominantWuxing).toBe("水");
  });

  it("午时 → 火旺 / dominantWuxing=火", () => {
    const r = computeTimeEnergy({ hourBranch: "午", guaWuxing: "金" });
    expect(r.dominantWuxing).toBe("火");
  });

  it("时辰与卦象同五行 → aligned (比和)", () => {
    const r = computeTimeEnergy({ hourBranch: "巳", guaWuxing: "火" });
    expect(r.alignment).toBe("aligned");
  });

  it("时辰生卦象 → aligned (顺势)", () => {
    // 子=水，水生木，卦五行=木
    const r = computeTimeEnergy({ hourBranch: "子", guaWuxing: "木" });
    expect(r.alignment).toBe("aligned");
  });

  it("时辰克卦象 → conflict", () => {
    // 申=金，金克木
    const r = computeTimeEnergy({ hourBranch: "申", guaWuxing: "木" });
    expect(r.alignment).toBe("conflict");
  });

  it("卦克时辰 → neutral", () => {
    // 子=水, 卦=土, 土克水
    const r = computeTimeEnergy({ hourBranch: "子", guaWuxing: "土" });
    expect(r.alignment).toBe("neutral");
  });

  it("用神 = 时辰主导五行 → supportYongShen=true", () => {
    const r = computeTimeEnergy({ hourBranch: "子", guaWuxing: "金", yongShen: "水" });
    expect(r.supportYongShen).toBe(true);
  });

  it("时辰生用神也算 supportYongShen=true", () => {
    // 子=水，水生木，用神=木
    const r = computeTimeEnergy({ hourBranch: "子", guaWuxing: "金", yongShen: "木" });
    expect(r.supportYongShen).toBe(true);
  });

  it("用神与时辰无关 → supportYongShen=false", () => {
    // 申=金, 用神=火（金克火不算 support）
    const r = computeTimeEnergy({ hourBranch: "申", guaWuxing: "土", yongShen: "火" });
    expect(r.supportYongShen).toBe(false);
  });

  it("yongShen 缺省 → supportYongShen=null", () => {
    const r = computeTimeEnergy({ hourBranch: "卯", guaWuxing: "金" });
    expect(r.supportYongShen).toBeNull();
  });

  it("summary 非空 + 含主五行字符", () => {
    const r = computeTimeEnergy({ hourBranch: "未", guaWuxing: "水", yongShen: "土" });
    expect(r.summary.length).toBeGreaterThan(10);
    expect(r.summary).toContain("土");
    expect(r.summary).toContain("水");
  });

  it("12 地支全覆盖（无遗漏）", () => {
    const all = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
    const expected = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"];
    all.forEach((b, i) => {
      const r = computeTimeEnergy({ hourBranch: b, guaWuxing: "金" });
      expect(r.dominantWuxing, `${b}应为${expected[i]}`).toBe(expected[i]);
    });
  });
});
