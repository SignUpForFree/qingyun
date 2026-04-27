import { describe, it, expect } from "vitest";
import {
  FORBIDDEN_CORE,
  FORBIDDEN_DIVINATION_EXTRA,
  ALL_FORBIDDEN,
  renderForbiddenLine,
  SOFT_REPLACEMENT_HINT,
} from "./forbidden-words";

describe("forbidden-words constants (M3.29)", () => {
  it("CORE 含基础 6 词", () => {
    expect(FORBIDDEN_CORE).toContain("大凶");
    expect(FORBIDDEN_CORE).toContain("倒霉");
    expect(FORBIDDEN_CORE).toContain("厄运");
    expect(FORBIDDEN_CORE).toContain("命中注定");
    expect(FORBIDDEN_CORE).toContain("注定");
    expect(FORBIDDEN_CORE).toContain("必然");
    expect(FORBIDDEN_CORE.length).toBe(6);
  });

  it("DIVINATION_EXTRA 含开源签数据古风强词", () => {
    expect(FORBIDDEN_DIVINATION_EXTRA).toContain("慎行");
    expect(FORBIDDEN_DIVINATION_EXTRA).toContain("凶险");
  });

  it("ALL_FORBIDDEN = CORE + EXTRA 无重复", () => {
    const set = new Set(ALL_FORBIDDEN);
    expect(set.size).toBe(ALL_FORBIDDEN.length);
    expect(set.size).toBe(FORBIDDEN_CORE.length + FORBIDDEN_DIVINATION_EXTRA.length);
  });

  it("renderForbiddenLine() 默认只列 CORE", () => {
    const line = renderForbiddenLine();
    expect(line).toContain("大凶");
    expect(line).toContain("命中注定");
    expect(line).not.toContain("慎行");
    expect(line).not.toContain("凶险");
  });

  it("renderForbiddenLine(true) 列出全部", () => {
    const line = renderForbiddenLine(true);
    expect(line).toContain("大凶");
    expect(line).toContain("慎行");
    expect(line).toContain("凶险");
  });

  it("SOFT_REPLACEMENT_HINT 给出柔和替代说法", () => {
    expect(SOFT_REPLACEMENT_HINT).toContain("先慢一步");
    expect(SOFT_REPLACEMENT_HINT).toContain("沉住气");
  });
});
