import { describe, it, expect } from "vitest";
import { castByNumbers, castByTime } from "./cast";
import { TRIGRAM_NUMBER, TRIGRAMS } from "./trigrams";

describe("castByNumbers — 1 个数字", () => {
  it("对称：上下卦相同", () => {
    const r = castByNumbers(15);
    expect(r.upper).toBe(r.lower);
    expect(r.method).toBe("number-1");
  });

  it("8 → 上下都是坤（8 mod 8 = 0 → 视为 8）", () => {
    const r = castByNumbers(8);
    expect(r.upper).toBe("坤");
    expect(r.lower).toBe("坤");
  });

  it("9 → 上下都是 9 mod 8 = 1 = 乾", () => {
    const r = castByNumbers(9);
    expect(r.upper).toBe("乾");
  });

  it("动爻 = N mod 6（0 视为 6）", () => {
    expect(castByNumbers(7).dongYao).toBe(1);
    expect(castByNumbers(12).dongYao).toBe(6); // 12 mod 6 = 0 → 6
    expect(castByNumbers(6).dongYao).toBe(6);
  });
});

describe("castByNumbers — 2 个数字", () => {
  it("分别取上下卦，动爻 = (N1+N2) mod 6", () => {
    const r = castByNumbers(3, 5);
    expect(TRIGRAM_NUMBER[r.upper]).toBe(3);
    expect(TRIGRAM_NUMBER[r.lower]).toBe(5);
    expect(r.dongYao).toBe(2); // 8 mod 6
    expect(r.method).toBe("number-2");
  });

  it("0 边界：8 → 8（坤）", () => {
    const r = castByNumbers(16, 24);
    expect(r.upper).toBe("坤");
    expect(r.lower).toBe("坤");
  });
});

describe("castByNumbers — 3 个数字", () => {
  it("分别取上 / 下 / 动爻", () => {
    const r = castByNumbers(1, 2, 3);
    expect(r.upper).toBe("乾");
    expect(r.lower).toBe("兑");
    expect(r.dongYao).toBe(3);
    expect(r.method).toBe("number-3");
  });

  it("动爻独立：(1, 2, 6) → dongYao = 6", () => {
    expect(castByNumbers(1, 2, 6).dongYao).toBe(6);
    expect(castByNumbers(1, 2, 12).dongYao).toBe(6); // 12 mod 6 = 0 → 6
  });
});

describe("castByNumbers — 校验", () => {
  it("0 / 负数 / 小数抛错", () => {
    expect(() => castByNumbers(0)).toThrow();
    expect(() => castByNumbers(-1)).toThrow();
    expect(() => castByNumbers(1.5)).toThrow();
  });

  it("4+ 个数字抛错", () => {
    expect(() => castByNumbers(1, 2, 3, 4)).toThrow();
  });

  it("0 个数字抛错", () => {
    expect(() => castByNumbers()).toThrow();
  });
});

describe("castByTime", () => {
  it("可重复跑，返回结构完整", () => {
    const t = new Date("2026-04-26T10:30:00+08:00");
    const r1 = castByTime(t);
    const r2 = castByTime(t);
    expect(r1.upper).toBe(r2.upper);
    expect(r1.lower).toBe(r2.lower);
    expect(r1.dongYao).toBe(r2.dongYao);
    expect(r1.method).toBe("time");
    expect(TRIGRAMS).toContain(r1.upper);
    expect(TRIGRAMS).toContain(r1.lower);
    expect(r1.dongYao).toBeGreaterThanOrEqual(1);
    expect(r1.dongYao).toBeLessThanOrEqual(6);
  });

  it("不同时间通常起出不同卦（弱断言：不强制）", () => {
    const a = castByTime(new Date("2026-04-26T10:30:00+08:00"));
    const b = castByTime(new Date("2026-04-26T22:00:00+08:00"));
    // 至少有一项不同（同日不同时辰，时支变了）
    const same =
      a.upper === b.upper && a.lower === b.lower && a.dongYao === b.dongYao;
    expect(same).toBe(false);
  });
});
