import { describe, it, expect } from "vitest";
import { normalizeHeadingLines } from "./markdown-headings";

describe("normalizeHeadingLines", () => {
  it("合并 **### 标题** 后的副标题", () => {
    const raw = "**### 本卦 · 随（䷐）**  主兆当下之事";
    expect(normalizeHeadingLines(raw)).toBe(
      "**### 本卦 · 随（䷐） · 主兆当下之事**",
    );
  });
});
