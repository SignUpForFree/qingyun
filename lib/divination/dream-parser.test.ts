import { describe, it, expect } from "vitest";
import {
  DREAM_EMOTIONS,
  buildEmotionHint,
  dreamInputSchema,
} from "./dream-parser";

describe("dreamInputSchema", () => {
  it("接受合法梦境（含 emotion）", () => {
    const r = dreamInputSchema.parse({
      dreamText: "我梦见自己在一片云海上飞，下面有人在喊我的名字",
      emotion: "平静",
    });
    expect(r.emotion).toBe("平静");
    expect(r.dreamText.length).toBeGreaterThan(10);
  });

  it("emotion 缺省合法", () => {
    const r = dreamInputSchema.parse({
      dreamText: "梦到一只白色的猫在阳台上看月亮",
    });
    expect(r.emotion).toBeUndefined();
  });

  it("trim 前后空格", () => {
    const r = dreamInputSchema.parse({
      dreamText: "   梦见在地铁里找不到出口，越走越远   ",
    });
    expect(r.dreamText.startsWith(" ")).toBe(false);
  });

  it("少于 10 字符抛错", () => {
    expect(() =>
      dreamInputSchema.parse({ dreamText: "做了梦" }),
    ).toThrow();
  });

  it("空字符串抛错", () => {
    expect(() =>
      dreamInputSchema.parse({ dreamText: "" }),
    ).toThrow();
  });

  it("超过 2000 字符抛错", () => {
    expect(() =>
      dreamInputSchema.parse({ dreamText: "梦".repeat(2001) }),
    ).toThrow();
  });

  it("非枚举 emotion 抛错", () => {
    expect(() =>
      dreamInputSchema.parse({
        dreamText: "梦见自己在写代码，写到天亮还没写完",
        emotion: "悲伤",
      }),
    ).toThrow();
  });
});

describe("buildEmotionHint", () => {
  it("无 emotion 返回 fallback 文案", () => {
    expect(buildEmotionHint(undefined)).toContain("未明确");
  });

  it("有 emotion 返回带 emotion 的提示", () => {
    expect(buildEmotionHint("害怕")).toContain("害怕");
  });

  it("覆盖全部 5 种 emotion", () => {
    for (const e of DREAM_EMOTIONS) {
      expect(buildEmotionHint(e)).toContain(e);
    }
  });
});
