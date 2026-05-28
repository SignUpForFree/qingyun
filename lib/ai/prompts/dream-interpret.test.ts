import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildDreamPrompt, extractDreamSections, DREAM_SYSTEM_PROMPT } from "./dream-interpret";

describe("buildDreamPrompt", () => {
  it("fast / precise 共用同一 system prompt，含 500–800 字限制", () => {
    const fast = buildDreamPrompt({ mode: "fast", dream: "梦见山顶" });
    const precise = buildDreamPrompt({
      mode: "precise",
      core: "梦见考试",
      emotion: "紧张",
    });
    expect(fast.systemPrompt).toBe(DREAM_SYSTEM_PROMPT);
    expect(precise.systemPrompt).toBe(DREAM_SYSTEM_PROMPT);
    expect(fast.systemPrompt).toContain("女性解梦师");
    expect(fast.systemPrompt).toContain("勿声称联网检索");
    expect(fast.systemPrompt).toContain("500–800 汉字");
    expect(precise.systemPrompt).toContain("梦境真正想提醒你的事");
    expect(fast.systemPrompt).not.toContain("当前能量与运势状态");
    expect(fast.userPrompt).toContain("6 段");
    expect(fast.userPrompt).toContain("500–800");
    expect(fast.userPrompt).toContain("梦见山顶");
  });

  it("precise 模式含 reality / special 字段", () => {
    const r = buildDreamPrompt({
      mode: "precise",
      core: "梦见考试",
      emotion: "紧张",
      reality: "下周面试",
      special: "数字 7",
    });
    expect(r.userPrompt).toContain("现实关联：下周面试");
    expect(r.userPrompt).toContain("特殊符号：数字 7");
  });

  it("禁词、篇幅与安全规则写入 system prompt", () => {
    expect(DREAM_SYSTEM_PROMPT).toContain("慎行");
    expect(DREAM_SYSTEM_PROMPT).toContain("凶兆");
    expect(DREAM_SYSTEM_PROMPT).toContain("500–800 汉字");
    expect(DREAM_SYSTEM_PROMPT).toContain("不要输出「作为 AI」");
  });
});

describe("extractDreamSections", () => {
  it("解析 Markdown 六段结构", () => {
    const text = [
      "**梦境核心解析**",
      "这个梦在回应你最近的丰盛感。",
      "",
      "**梦境元素与象征解读**",
      "河流 → 周公解梦：财源 · 情绪之流 → 现实映射。",
      "",
      "**潜意识情绪分析**",
      "你其实一直在压抑期待。",
      "",
      "**感情与人际关系映射**",
      "关系里有些拉扯。",
      "",
      "**梦境真正想提醒你的事**",
      "停下来照顾自己。",
      "",
      "**建议与结尾**",
      "- 早点休息",
      "有时候梦不是预言，而是潜意识终于开始替你说话。",
    ].join("\n");

    const s = extractDreamSections(text);
    expect(s.empathy).toContain("丰盛感");
    expect(s.threeViews.zhouGong).toContain("周公解梦");
    expect(s.threeViews.freud).toContain("压抑");
    expect(s.threeViews.jung).toContain("拉扯");
    expect(s.coreMeaning).toContain("照顾自己");
    expect(s.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(s.conclusion).toContain("潜意识");
  });
});
