import { describe, it, expect } from "vitest";
import { isSlipLevel, SLIP_LEVELS } from "./slip-level";

describe("isSlipLevel (6 级)", () => {
  it("接受 6 个有效等级", () => {
    for (const l of SLIP_LEVELS) {
      expect(isSlipLevel(l)).toBe(true);
    }
  });

  it("拒绝旧 5 级体系的值", () => {
    expect(isSlipLevel("中吉")).toBe(false);
    expect(isSlipLevel("中平")).toBe(false);
    expect(isSlipLevel("下下")).toBe(false);
  });

  it("拒绝非字符串", () => {
    expect(isSlipLevel(undefined)).toBe(false);
    expect(isSlipLevel(null)).toBe(false);
    expect(isSlipLevel(42)).toBe(false);
  });
});
