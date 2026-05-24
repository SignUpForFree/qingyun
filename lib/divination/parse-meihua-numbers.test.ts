import { describe, expect, it } from "vitest";
import {
  parseMeihuaNumberFields,
  parseMeihuaNumbers,
  splitDigitsIntoThree,
} from "./parse-meihua-numbers";

describe("splitDigitsIntoThree", () => {
  it("splits 294590 into 29, 45, 90", () => {
    expect(splitDigitsIntoThree("294590")).toEqual([29, 45, 90]);
  });

  it("distributes remainder to front segments", () => {
    expect(splitDigitsIntoThree("1234567")).toEqual([123, 45, 67]);
  });
});

describe("parseMeihuaNumberFields", () => {
  it("parses three separate 1-99 fields", () => {
    expect(parseMeihuaNumberFields("2", "5", "7")).toEqual({
      ok: true,
      numbers: [2, 5, 7],
    });
    expect(parseMeihuaNumberFields("29", "45", "90")).toEqual({
      ok: true,
      numbers: [29, 45, 90],
    });
  });

  it("rejects empty or out-of-range values", () => {
    expect(parseMeihuaNumberFields("", "5", "7").ok).toBe(false);
    expect(parseMeihuaNumberFields("100", "5", "7").ok).toBe(false);
  });
});

describe("parseMeihuaNumbers", () => {
  it("parses punctuation-separated numbers", () => {
    expect(parseMeihuaNumbers("29,45,90")).toEqual({
      ok: true,
      numbers: [29, 45, 90],
    });
    expect(parseMeihuaNumbers("29、45、90")).toEqual({
      ok: true,
      numbers: [29, 45, 90],
    });
    expect(parseMeihuaNumbers("29 45 90")).toEqual({
      ok: true,
      numbers: [29, 45, 90],
    });
  });

  it("parses continuous digits without separators", () => {
    expect(parseMeihuaNumbers("294590")).toEqual({
      ok: true,
      numbers: [29, 45, 90],
    });
  });

  it("allows arbitrary magnitudes not limited to 1-9", () => {
    expect(parseMeihuaNumbers("100,200,300")).toEqual({
      ok: true,
      numbers: [100, 200, 300],
    });
  });

  it("rejects wrong segment count when using separators", () => {
    expect(parseMeihuaNumbers("294,590").ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(parseMeihuaNumbers("   ").ok).toBe(false);
  });
});
