import { describe, it, expect } from "vitest";
import {
  wuxingOf,
  tenGod,
  branchHourRange,
  relation,
  isStem,
  isBranch,
  TEN_STEMS,
  TWELVE_BRANCHES,
  SHENG_CYCLE,
  KE_CYCLE,
} from "./stems-branches";

describe("wuxingOf - 天干", () => {
  it("甲乙=木", () => {
    expect(wuxingOf("甲")).toBe("木");
    expect(wuxingOf("乙")).toBe("木");
  });
  it("丙丁=火", () => {
    expect(wuxingOf("丙")).toBe("火");
    expect(wuxingOf("丁")).toBe("火");
  });
  it("戊己=土", () => {
    expect(wuxingOf("戊")).toBe("土");
    expect(wuxingOf("己")).toBe("土");
  });
  it("庚辛=金", () => {
    expect(wuxingOf("庚")).toBe("金");
    expect(wuxingOf("辛")).toBe("金");
  });
  it("壬癸=水", () => {
    expect(wuxingOf("壬")).toBe("水");
    expect(wuxingOf("癸")).toBe("水");
  });
});

describe("wuxingOf - 地支", () => {
  it("子=水, 午=火, 卯=木, 酉=金", () => {
    expect(wuxingOf("子")).toBe("水");
    expect(wuxingOf("午")).toBe("火");
    expect(wuxingOf("卯")).toBe("木");
    expect(wuxingOf("酉")).toBe("金");
  });
  it("辰戌丑未=土", () => {
    expect(wuxingOf("辰")).toBe("土");
    expect(wuxingOf("戌")).toBe("土");
    expect(wuxingOf("丑")).toBe("土");
    expect(wuxingOf("未")).toBe("土");
  });
});

describe("tenGod (基于日主)", () => {
  it("日主戊（土阳）看见甲（木阳）= 七杀（同阴阳，木克土）", () => {
    expect(tenGod("戊", "甲")).toBe("七杀");
  });
  it("日主戊看见乙（木阴）= 正官", () => {
    expect(tenGod("戊", "乙")).toBe("正官");
  });
  it("日主戊看见癸（水阴）= 正财（土克水，异阴阳）", () => {
    expect(tenGod("戊", "癸")).toBe("正财");
  });
  it("日主戊看见戊 = 比肩（同我同阴阳）", () => {
    expect(tenGod("戊", "戊")).toBe("比肩");
  });
  it("日主戊看见己 = 劫财（同我异阴阳）", () => {
    expect(tenGod("戊", "己")).toBe("劫财");
  });
  it("日主戊看见庚 = 食神（戊生庚的反向: 土生金, 同阴阳）", () => {
    expect(tenGod("戊", "庚")).toBe("食神");
  });
  it("日主戊看见丁（火阴）= 正印（火生土异阴阳）", () => {
    expect(tenGod("戊", "丁")).toBe("正印");
  });
  it("日主甲（木阳）看见甲 = 比肩", () => {
    expect(tenGod("甲", "甲")).toBe("比肩");
  });
});

describe("branchHourRange", () => {
  it("子时 = 23:00–01:00 (跨夜)", () => {
    expect(branchHourRange("子")).toEqual({ startHour: 23, endHour: 1 });
  });
  it("午时 = 11:00–13:00", () => {
    expect(branchHourRange("午")).toEqual({ startHour: 11, endHour: 13 });
  });
  it("12 个地支都有时辰范围", () => {
    for (const b of TWELVE_BRANCHES) {
      const r = branchHourRange(b);
      expect(r.startHour).toBeGreaterThanOrEqual(0);
      expect(r.startHour).toBeLessThan(24);
    }
  });
});

describe("relation - 五行生克", () => {
  it("木→木=same", () => {
    expect(relation("木", "木")).toBe("same");
  });
  it("木→火=sheng (我生)", () => {
    expect(relation("木", "火")).toBe("sheng");
  });
  it("木→土=ke (我克)", () => {
    expect(relation("木", "土")).toBe("ke");
  });
  it("木→水=shengBy (生我)", () => {
    expect(relation("木", "水")).toBe("shengBy");
  });
  it("木→金=keBy (克我)", () => {
    expect(relation("木", "金")).toBe("keBy");
  });
});

describe("isStem / isBranch", () => {
  it("isStem 区分天干和非天干", () => {
    expect(isStem("甲")).toBe(true);
    expect(isStem("子")).toBe(false);
    expect(isStem("X")).toBe(false);
  });
  it("isBranch 区分地支和非地支", () => {
    expect(isBranch("子")).toBe(true);
    expect(isBranch("甲")).toBe(false);
    expect(isBranch("X")).toBe(false);
  });
});

describe("常量长度", () => {
  it("10 天干", () => {
    expect(TEN_STEMS).toHaveLength(10);
  });
  it("12 地支", () => {
    expect(TWELVE_BRANCHES).toHaveLength(12);
  });
});

describe("生克循环闭合", () => {
  it("生克链各 5 项", () => {
    expect(Object.keys(SHENG_CYCLE)).toHaveLength(5);
    expect(Object.keys(KE_CYCLE)).toHaveLength(5);
  });
});
