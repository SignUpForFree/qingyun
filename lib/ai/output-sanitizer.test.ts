import { describe, it, expect } from "vitest";
import { sanitizeAiOutput, detectForbidden } from "./output-sanitizer";

describe("sanitizeAiOutput (M3.34)", () => {
  it("无禁词时原文不变 + hitCount=0", () => {
    const r = sanitizeAiOutput("今天适合静一静，慢慢来。");
    expect(r.cleaned).toBe("今天适合静一静，慢慢来。");
    expect(r.hitCount).toBe(0);
    expect(r.hitWords).toEqual([]);
  });

  it("命中『大凶』→ 替换为『需多留意』", () => {
    const r = sanitizeAiOutput("此运大凶，恐有变故。");
    expect(r.cleaned).toContain("需多留意");
    expect(r.cleaned).not.toContain("大凶");
    expect(r.hitWords).toContain("大凶");
  });

  it("命中『命中注定』→ 替换为『趋势如此』", () => {
    const r = sanitizeAiOutput("这是命中注定的结果。");
    expect(r.cleaned).toContain("趋势如此");
    expect(r.cleaned).not.toContain("命中注定");
  });

  it("一段话多个禁词都被替换", () => {
    const r = sanitizeAiOutput("此事大凶，必然倒霉，命中注定如此。");
    expect(r.cleaned).not.toContain("大凶");
    expect(r.cleaned).not.toContain("必然");
    expect(r.cleaned).not.toContain("倒霉");
    expect(r.cleaned).not.toContain("命中注定");
    expect(r.hitCount).toBeGreaterThanOrEqual(4);
  });

  it("scope=divination 时『慎行 / 凶险』也被替换", () => {
    const r = sanitizeAiOutput("此签慎行，凶险将至。", "divination");
    expect(r.cleaned).not.toContain("慎行");
    expect(r.cleaned).not.toContain("凶险");
    expect(r.cleaned).toContain("稳一些");
    expect(r.cleaned).toContain("需小心");
  });

  it("dream 专用『凶兆 / 不祥』也被替换", () => {
    const r = sanitizeAiOutput("梦境凶兆，不祥之兆。");
    expect(r.cleaned).not.toContain("凶兆");
    expect(r.cleaned).not.toContain("不祥");
  });

  it("替换是幂等的（再跑一次 hitCount=0）", () => {
    const once = sanitizeAiOutput("大凶大不祥。");
    expect(once.hitCount).toBeGreaterThan(0);
    const twice = sanitizeAiOutput(once.cleaned);
    expect(twice.hitCount).toBe(0);
  });
});

describe("detectForbidden (audit)", () => {
  it("空文本 → []", () => {
    expect(detectForbidden("")).toEqual([]);
  });

  it("命中所有词都列出", () => {
    const hits = detectForbidden("大凶 倒霉 厄运 命中注定 凶兆");
    expect(hits).toContain("大凶");
    expect(hits).toContain("倒霉");
    expect(hits).toContain("厄运");
    expect(hits).toContain("命中注定");
    expect(hits).toContain("凶兆");
  });

  it("中性句无命中", () => {
    expect(detectForbidden("今天天气不错")).toEqual([]);
  });
});
