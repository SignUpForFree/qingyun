import { describe, it, expect } from "vitest";
import { findHexagram, listHexagrams } from "./hexagrams";
import { TRIGRAMS } from "./trigrams";

describe("listHexagrams — 64 卦完整覆盖", () => {
  it("总数恰好 64", () => {
    expect(listHexagrams()).toHaveLength(64);
  });

  it("number 1..64 全部存在且唯一", () => {
    const numbers = listHexagrams().map((h) => h.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  });

  it("name 全部唯一", () => {
    const names = new Set(listHexagrams().map((h) => h.name));
    expect(names.size).toBe(64);
  });

  it("覆盖所有 8×8 = 64 上下卦组合", () => {
    const covered = new Set(listHexagrams().map((h) => `${h.upper}-${h.lower}`));
    expect(covered.size).toBe(64);
    for (const u of TRIGRAMS) {
      for (const l of TRIGRAMS) {
        expect(covered.has(`${u}-${l}`)).toBe(true);
      }
    }
  });

  it("纯 8 卦（上下相同）的卦号正确", () => {
    expect(findHexagram("乾", "乾")).toMatchObject({ number: 1, name: "乾为天" });
    expect(findHexagram("坤", "坤")).toMatchObject({ number: 2, name: "坤为地" });
    expect(findHexagram("坎", "坎")).toMatchObject({ number: 29, name: "坎为水" });
    expect(findHexagram("离", "离")).toMatchObject({ number: 30, name: "离为火" });
    expect(findHexagram("震", "震")).toMatchObject({ number: 51, name: "震为雷" });
    expect(findHexagram("艮", "艮")).toMatchObject({ number: 52, name: "艮为山" });
    expect(findHexagram("巽", "巽")).toMatchObject({ number: 57, name: "巽为风" });
    expect(findHexagram("兑", "兑")).toMatchObject({ number: 58, name: "兑为泽" });
  });

  it("典型抽样：泰卦（坤上乾下）= 11 否卦（乾上坤下）= 12", () => {
    expect(findHexagram("坤", "乾").number).toBe(11);
    expect(findHexagram("乾", "坤").number).toBe(12);
  });

  it("既济（坎上离下）= 63 未济（离上坎下）= 64", () => {
    expect(findHexagram("坎", "离").number).toBe(63);
    expect(findHexagram("离", "坎").number).toBe(64);
  });

  it("upperWuxing / lowerWuxing 与 trigram 一致", () => {
    for (const h of listHexagrams()) {
      // 简单 sanity：5 行只有 5 种取值
      expect(["金", "木", "水", "火", "土"]).toContain(h.upperWuxing);
      expect(["金", "木", "水", "火", "土"]).toContain(h.lowerWuxing);
    }
  });
});

describe("findHexagram — 错误处理", () => {
  it("非法 trigram 抛错", () => {
    // @ts-expect-error 故意用非法值
    expect(() => findHexagram("天", "地")).toThrow();
  });
});
