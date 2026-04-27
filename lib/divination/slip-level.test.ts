import { describe, it, expect } from "vitest";
import { seedToSpecLevel, isSpecLevel, SPEC_LEVELS } from "./slip-level";

describe("seedToSpecLevel (M3.1)", () => {
  it("上上/上吉 直通", () => {
    expect(seedToSpecLevel("上上")).toBe("上上");
    expect(seedToSpecLevel("上吉")).toBe("上吉");
  });

  it("吉 → 中吉", () => {
    expect(seedToSpecLevel("吉")).toBe("中吉");
  });

  it("平 / 渐顺 → 中平", () => {
    expect(seedToSpecLevel("平")).toBe("中平");
    expect(seedToSpecLevel("渐顺")).toBe("中平");
  });

  it("慎行 → 下下", () => {
    expect(seedToSpecLevel("慎行")).toBe("下下");
  });

  it("已经是 spec level 直通", () => {
    for (const l of SPEC_LEVELS) {
      expect(seedToSpecLevel(l)).toBe(l);
    }
  });
});

describe("isSpecLevel", () => {
  it("接受 5 个 spec level", () => {
    for (const l of SPEC_LEVELS) {
      expect(isSpecLevel(l)).toBe(true);
    }
  });

  it("拒绝 seed-only level", () => {
    expect(isSpecLevel("吉")).toBe(false);
    expect(isSpecLevel("平")).toBe(false);
    expect(isSpecLevel("渐顺")).toBe(false);
    expect(isSpecLevel("慎行")).toBe(false);
  });

  it("拒绝非字符串", () => {
    expect(isSpecLevel(undefined)).toBe(false);
    expect(isSpecLevel(null)).toBe(false);
    expect(isSpecLevel(42)).toBe(false);
  });
});
