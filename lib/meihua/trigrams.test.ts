import { describe, it, expect } from "vitest";
import {
  TRIGRAMS,
  TRIGRAM_LINES,
  TRIGRAM_NUMBER,
  TRIGRAM_WUXING,
  linesToTrigram,
  trigramByNumber,
} from "./trigrams";

describe("trigramByNumber", () => {
  it("1-8 全部映射正确", () => {
    expect(trigramByNumber(1)).toBe("乾");
    expect(trigramByNumber(2)).toBe("兑");
    expect(trigramByNumber(3)).toBe("离");
    expect(trigramByNumber(4)).toBe("震");
    expect(trigramByNumber(5)).toBe("巽");
    expect(trigramByNumber(6)).toBe("坎");
    expect(trigramByNumber(7)).toBe("艮");
    expect(trigramByNumber(8)).toBe("坤");
  });

  it("0 视为 8（坤）", () => {
    expect(trigramByNumber(0)).toBe("坤");
  });

  it("超范围抛错", () => {
    expect(() => trigramByNumber(9)).toThrow();
    expect(() => trigramByNumber(-1)).toThrow();
    expect(() => trigramByNumber(1.5)).toThrow();
  });
});

describe("TRIGRAM_NUMBER 一致", () => {
  it("8 个卦各一个数字，覆盖 1-8", () => {
    const numbers = TRIGRAMS.map((t) => TRIGRAM_NUMBER[t]).sort();
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("trigramByNumber 是 TRIGRAM_NUMBER 的逆", () => {
    for (const t of TRIGRAMS) {
      expect(trigramByNumber(TRIGRAM_NUMBER[t])).toBe(t);
    }
  });
});

describe("TRIGRAM_WUXING", () => {
  it("乾兑金，离火，震巽木，坎水，艮坤土", () => {
    expect(TRIGRAM_WUXING.乾).toBe("金");
    expect(TRIGRAM_WUXING.兑).toBe("金");
    expect(TRIGRAM_WUXING.离).toBe("火");
    expect(TRIGRAM_WUXING.震).toBe("木");
    expect(TRIGRAM_WUXING.巽).toBe("木");
    expect(TRIGRAM_WUXING.坎).toBe("水");
    expect(TRIGRAM_WUXING.艮).toBe("土");
    expect(TRIGRAM_WUXING.坤).toBe("土");
  });
});

describe("linesToTrigram", () => {
  it("是 TRIGRAM_LINES 的逆", () => {
    for (const t of TRIGRAMS) {
      expect(linesToTrigram(TRIGRAM_LINES[t])).toBe(t);
    }
  });

  it("乾三阳", () => {
    expect(linesToTrigram([true, true, true])).toBe("乾");
  });

  it("坤三阴", () => {
    expect(linesToTrigram([false, false, false])).toBe("坤");
  });

  it("离中虚（阳阴阳）", () => {
    expect(linesToTrigram([true, false, true])).toBe("离");
  });

  it("坎中满（阴阳阴）", () => {
    expect(linesToTrigram([false, true, false])).toBe("坎");
  });
});
