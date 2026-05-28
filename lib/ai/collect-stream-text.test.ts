import { describe, it, expect } from "vitest";
import {
  collectStreamText,
  isDreamEmptyContent,
  DREAM_LEGACY_EMPTY_PLACEHOLDER,
} from "./collect-stream-text";

describe("isDreamEmptyContent", () => {
  it("识别空串与历史占位", () => {
    expect(isDreamEmptyContent("")).toBe(true);
    expect(isDreamEmptyContent(DREAM_LEGACY_EMPTY_PLACEHOLDER)).toBe(true);
    expect(isDreamEmptyContent("梦见河流")).toBe(false);
  });
});

describe("collectStreamText", () => {
  it("textStream 有内容 → 直接返回", async () => {
    const r = await collectStreamText({
      textStream: (async function* () {
        yield "你好";
      })(),
      text: Promise.resolve(""),
      usage: Promise.resolve({ totalTokens: 3 }),
      finishReason: Promise.resolve("stop"),
    });
    expect(r.text).toBe("你好");
  });

  it("textStream 空、stream.text 有内容 → 兜底", async () => {
    const r = await collectStreamText({
      textStream: (async function* () {})(),
      text: Promise.resolve("聚合正文"),
      usage: Promise.resolve({ totalTokens: 10 }),
      finishReason: Promise.resolve("stop"),
    });
    expect(r.text).toBe("聚合正文");
  });
});
