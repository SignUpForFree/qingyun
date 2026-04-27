import { describe, it, expect } from "vitest";
import {
  computeDayun,
  computeLiunian,
  yearToPillar,
  rotateMonthPillar,
} from "./dayun";
import type { BaziPillars } from "@/types/domain";

const samplePillars: BaziPillars = {
  // 1995 乙亥年（阴），月柱己卯（举例）
  year: { gan: "乙", zhi: "亥" },
  month: { gan: "己", zhi: "卯" },
  day: { gan: "甲", zhi: "子" },
  hour: { gan: "庚", zhi: "午" },
};

const yangYearPillars: BaziPillars = {
  // 1996 丙子年（阳）
  year: { gan: "丙", zhi: "子" },
  month: { gan: "辛", zhi: "丑" },
  day: { gan: "庚", zhi: "辰" },
  hour: { gan: "戊", zhi: "寅" },
};

describe("rotateMonthPillar", () => {
  it("顺排 2 步：己卯 → 庚辰 / 辛巳", () => {
    const r = rotateMonthPillar("己", "卯", true, 2);
    expect(r[0]).toEqual({ stem: "庚", branch: "辰" });
    expect(r[1]).toEqual({ stem: "辛", branch: "巳" });
  });

  it("逆排 2 步：己卯 → 戊寅 / 丁丑", () => {
    const r = rotateMonthPillar("己", "卯", false, 2);
    expect(r[0]).toEqual({ stem: "戊", branch: "寅" });
    expect(r[1]).toEqual({ stem: "丁", branch: "丑" });
  });

  it("8 步全循环不重复", () => {
    const r = rotateMonthPillar("甲", "子", true, 8);
    const names = r.map((s) => `${s.stem}${s.branch}`);
    expect(new Set(names).size).toBe(8);
  });
});

describe("computeDayun (M3.8)", () => {
  it("8 步默认", () => {
    const r = computeDayun({
      pillars: samplePillars,
      gender: "male",
      solarBirthDate: new Date(1995, 2, 22),
    });
    expect(r).toHaveLength(8);
  });

  it("阴年男 → 逆排（月柱己卯 → 戊寅起）", () => {
    const r = computeDayun({
      pillars: samplePillars,
      gender: "male",
      solarBirthDate: new Date(1995, 2, 22),
      startAge: 5,
    });
    expect(r[0].pillar).toBe("戊寅");
    expect(r[1].pillar).toBe("丁丑");
  });

  it("阴年女 → 顺排（月柱己卯 → 庚辰起）", () => {
    const r = computeDayun({
      pillars: samplePillars,
      gender: "female",
      solarBirthDate: new Date(1995, 2, 22),
      startAge: 5,
    });
    expect(r[0].pillar).toBe("庚辰");
    expect(r[1].pillar).toBe("辛巳");
  });

  it("阳年男 → 顺排（月柱辛丑 → 壬寅起）", () => {
    const r = computeDayun({
      pillars: yangYearPillars,
      gender: "male",
      solarBirthDate: new Date(1996, 0, 5),
      startAge: 5,
    });
    expect(r[0].pillar).toBe("壬寅");
    expect(r[1].pillar).toBe("癸卯");
  });

  it("阳年女 → 逆排（月柱辛丑 → 庚子起）", () => {
    const r = computeDayun({
      pillars: yangYearPillars,
      gender: "female",
      solarBirthDate: new Date(1996, 0, 5),
      startAge: 5,
    });
    expect(r[0].pillar).toBe("庚子");
    expect(r[1].pillar).toBe("己亥");
  });

  it("startAge + 每步 10 年", () => {
    const r = computeDayun({
      pillars: samplePillars,
      gender: "male",
      solarBirthDate: new Date(1995, 2, 22),
      startAge: 7,
    });
    expect(r[0].startAge).toBe(7);
    expect(r[0].endAge).toBe(16);
    expect(r[1].startAge).toBe(17);
    expect(r[1].endAge).toBe(26);
  });

  it("自定义 steps", () => {
    const r = computeDayun({
      pillars: samplePillars,
      gender: "male",
      solarBirthDate: new Date(1995, 2, 22),
      startAge: 5,
      steps: 4,
    });
    expect(r).toHaveLength(4);
  });
});

describe("yearToPillar (M3.9)", () => {
  it("1984 = 甲子", () => {
    expect(yearToPillar(1984)).toEqual({ stem: "甲", branch: "子" });
  });

  it("1985 = 乙丑", () => {
    expect(yearToPillar(1985)).toEqual({ stem: "乙", branch: "丑" });
  });

  it("1995 = 乙亥", () => {
    expect(yearToPillar(1995)).toEqual({ stem: "乙", branch: "亥" });
  });

  it("2026 = 丙午", () => {
    expect(yearToPillar(2026)).toEqual({ stem: "丙", branch: "午" });
  });

  it("2044 = 甲子（60 年回归）", () => {
    expect(yearToPillar(2044)).toEqual({ stem: "甲", branch: "子" });
  });

  it("1924 = 甲子（前 60 年）", () => {
    expect(yearToPillar(1924)).toEqual({ stem: "甲", branch: "子" });
  });
});

describe("computeLiunian (M3.9)", () => {
  it("默认 span=5：返回 5 年", () => {
    const r = computeLiunian({ centerYear: 2026 });
    expect(r).toHaveLength(5);
  });

  it("span=5 中心是 2026 = 丙午", () => {
    const r = computeLiunian({ centerYear: 2026 });
    expect(r[2].year).toBe(2026);
    expect(r[2].pillar).toBe("丙午");
    expect(r[2].offset).toBe(0);
  });

  it("span=5 包含 2024-2028", () => {
    const r = computeLiunian({ centerYear: 2026 });
    expect(r.map((s) => s.year)).toEqual([2024, 2025, 2026, 2027, 2028]);
  });

  it("span=3 仅前后各 1", () => {
    const r = computeLiunian({ centerYear: 2026, span: 3 });
    expect(r).toHaveLength(3);
    expect(r[0].year).toBe(2025);
    expect(r[2].year).toBe(2027);
  });

  it("span=1 只返回中心年", () => {
    const r = computeLiunian({ centerYear: 2026, span: 1 });
    expect(r).toHaveLength(1);
    expect(r[0].year).toBe(2026);
  });
});
