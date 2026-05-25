import { describe, it, expect } from "vitest";
import {
  bianGua,
  buildHexagram,
  huGua,
  type HexagramShape,
} from "./transform";

describe("buildHexagram", () => {
  it("乾为天：六爻全阳", () => {
    const h = buildHexagram("乾", "乾");
    expect(h.lines).toEqual([true, true, true, true, true, true]);
  });

  it("坤为地：六爻全阴", () => {
    const h = buildHexagram("坤", "坤");
    expect(h.lines).toEqual([false, false, false, false, false, false]);
  });

  it("水雷屯（坎上震下）：lower=震[阳阴阴], upper=坎[阴阳阴]", () => {
    const h = buildHexagram("坎", "震");
    expect(h.lines).toEqual([true, false, false, false, true, false]);
  });
});

describe("bianGua", () => {
  it("动爻 1：底爻翻转", () => {
    const h = buildHexagram("乾", "乾");
    const b = bianGua(h, 1);
    expect(b.lines[0]).toBe(false);
    expect(b.lines.slice(1)).toEqual([true, true, true, true, true]);
    expect(b.lower).toBe("巽"); // 阴阳阳
    expect(b.upper).toBe("乾");
  });

  it("动爻 6：顶爻翻转", () => {
    const h = buildHexagram("乾", "乾");
    const b = bianGua(h, 6);
    expect(b.lines[5]).toBe(false);
    expect(b.upper).toBe("兑"); // 阳阳阴
  });

  it("两次同动爻还原", () => {
    const h = buildHexagram("坎", "离");
    const b1 = bianGua(h, 3);
    const b2 = bianGua(b1, 3);
    expect(b2.lines).toEqual(h.lines);
  });

  it("超范围抛错", () => {
    const h = buildHexagram("乾", "乾");
    expect(() => bianGua(h, 0)).toThrow();
    expect(() => bianGua(h, 7)).toThrow();
    expect(() => bianGua(h, 2.5)).toThrow();
  });
});

describe("huGua", () => {
  it("乾为天的互卦还是乾为天（爻 2-5 全阳）", () => {
    const h = buildHexagram("乾", "乾");
    expect(huGua(h)).toMatchObject({ upper: "乾", lower: "乾" });
  });

  it("坤为地的互卦还是坤为地", () => {
    const h = buildHexagram("坤", "坤");
    expect(huGua(h)).toMatchObject({ upper: "坤", lower: "坤" });
  });

  it("水雷屯（坎上震下）的互卦：山地剥（艮上坤下）", () => {
    // 屯 lines = [阳阴阴, 阴阳阴] → [T,F,F,F,T,F]
    // 取 [1..3]=[F,F,F]=坤(下), [2..4]=[F,F,T]=艮(上)
    const h = buildHexagram("坎", "震");
    const hu = huGua(h);
    expect(hu.lower).toBe("坤");
    expect(hu.upper).toBe("艮");
  });

  it("互卦的 lines 只来自原卦 2-5 爻", () => {
    const h: HexagramShape = {
      upper: "兑",
      lower: "巽",
      lines: [false, true, true, true, true, false],
    };
    const hu = huGua(h);
    // 下三 = [1,2,3] = [T,T,T] = 乾
    // 上三 = [2,3,4] = [T,T,T] = 乾
    expect(hu.upper).toBe("乾");
    expect(hu.lower).toBe("乾");
  });
});
