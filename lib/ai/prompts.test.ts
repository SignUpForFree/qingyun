import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderTemplate,
  setPromptForTest,
  getCachedPrompt,
  clearPromptCache,
  loadPrompt,
} from "./prompts";

describe("renderTemplate", () => {
  it("替换 {placeholder}", () => {
    const out = renderTemplate("你好 {name}, 今天是 {date}", {
      name: "edy",
      date: "2026-04-26",
    });
    expect(out).toBe("你好 edy, 今天是 2026-04-26");
  });

  it("数字变量自动转字符串", () => {
    expect(renderTemplate("分数 {score}", { score: 88 })).toBe("分数 88");
  });

  it("缺失变量保持原样并发警告", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = renderTemplate("hi {x}", {});
    expect(out).toBe("hi {x}");
    expect(warn).toHaveBeenCalledWith("prompt 模板缺失变量: x");
    warn.mockRestore();
  });

  it("不替换非占位符", () => {
    const out = renderTemplate("纯文本无变量", { foo: "bar" });
    expect(out).toBe("纯文本无变量");
  });

  it("同一变量多次出现都被替换", () => {
    expect(renderTemplate("{x}-{x}-{x}", { x: "9" })).toBe("9-9-9");
  });
});

describe("缓存（setPromptForTest / getCachedPrompt / clearPromptCache）", () => {
  beforeEach(() => clearPromptCache());

  it("set 后 get 能取回", () => {
    setPromptForTest({
      key: "test.key",
      version: 1,
      systemPrompt: "你是助手",
      userPromptTpl: "请回答 {question}",
    });
    expect(getCachedPrompt("test.key")?.systemPrompt).toBe("你是助手");
  });

  it("clear 后 get 返回 undefined", () => {
    setPromptForTest({
      key: "test.key",
      version: 1,
      systemPrompt: "x",
      userPromptTpl: "y",
    });
    clearPromptCache();
    expect(getCachedPrompt("test.key")).toBeUndefined();
  });

  it("loadPrompt 缓存命中时直接返回", async () => {
    setPromptForTest({
      key: "fortune.daily",
      version: 1,
      systemPrompt: "sys",
      userPromptTpl: "tpl",
    });
    const r = await loadPrompt("fortune.daily");
    expect(r.systemPrompt).toBe("sys");
  });

  it("loadPrompt 未命中且无 supabase 时抛错（P1 占位行为）", async () => {
    clearPromptCache();
    await expect(loadPrompt("missing.key")).rejects.toThrow(/未实装/);
  });
});
