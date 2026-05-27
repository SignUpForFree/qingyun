import { describe, it, expect } from "vitest";
import { stripMeihuaReadingPreamble } from "./reading-display";

describe("stripMeihuaReadingPreamble", () => {
  it("去掉文首三行元数据", () => {
    const raw = `# 测算结果解读

测算时间：2026年5月27日 16:35
测算事由：职业
起卦方式：数字起卦（1, 4, 6）

**## 一、测算溯源 · 象数推演**

正文`;
    expect(stripMeihuaReadingPreamble(raw)).toContain("**## 一、测算溯源");
    expect(stripMeihuaReadingPreamble(raw)).not.toContain("测算时间");
  });

  it("去掉挤在一行的文首", () => {
    const raw =
      "# 测算结果解读 测算时间：2026年5月27日 16:35 测算事由：职业 起卦方式：数字起卦 (1, 4, 6) **## 一、测算溯源 · 象数推演**";
    const out = stripMeihuaReadingPreamble(raw);
    expect(out.startsWith("**## 一、")).toBe(true);
  });

  it("第一节未到时返回空（避免红框闪现）", () => {
    expect(
      stripMeihuaReadingPreamble("# 测算结果解读 测算时间：2026年"),
    ).toBe("");
  });
});
