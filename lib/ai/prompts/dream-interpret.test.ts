import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildDreamPrompt, extractDreamSections } from "./dream-interpret";

describe("buildDreamPrompt", () => {
  it("fast 模式使用精准 prompt（6段结构）", () => {
    const r = buildDreamPrompt({ mode: "fast", dream: "梦见山顶" });
    expect(r.systemPrompt).toContain("🌙");
    expect(r.systemPrompt).toContain("🔮");
    expect(r.userPrompt).toContain("梦见山顶");
  });

  it("precise 模式返回 6 段结构 prompt", () => {
    const r = buildDreamPrompt({
      mode: "precise",
      core: "梦见考试",
      emotion: "紧张",
      reality: "下周面试",
      special: "数字 7",
    });
    expect(r.systemPrompt).toContain("🌙");
    expect(r.systemPrompt).toContain("🔮");
    expect(r.systemPrompt).toContain("📜");
    expect(r.systemPrompt).toContain("💡");
    expect(r.systemPrompt).toContain("💌");
    expect(r.systemPrompt).toContain("🌷");
    expect(r.systemPrompt).toContain("周公解梦");
    expect(r.systemPrompt).toContain("弗洛伊德");
    expect(r.systemPrompt).toContain("荣格");
    expect(r.userPrompt).toContain("核心场景：梦见考试");
    expect(r.userPrompt).toContain("情绪感受：紧张");
    expect(r.userPrompt).toContain("现实关联：下周面试");
    expect(r.userPrompt).toContain("特殊符号：数字 7");
  });

  it("precise 模式缺 reality / special → 不输出对应行", () => {
    const r = buildDreamPrompt({
      mode: "precise",
      core: "梦见水",
      emotion: "平静",
    });
    expect(r.userPrompt).not.toContain("现实关联");
    expect(r.userPrompt).not.toContain("特殊符号");
  });

  it("禁词包含 慎行 / 凶兆 / 不祥", () => {
    const r = buildDreamPrompt({ mode: "fast", dream: "x" });
    expect(r.systemPrompt).toContain("慎行");
    expect(r.systemPrompt).toContain("凶兆");
    expect(r.systemPrompt).toContain("不祥");
  });
});

describe("extractDreamSections", () => {
  it("完整 6 段解析", () => {
    const text = [
      "🌙 这不是厄运，是潜意识的预警",
      "",
      "🔮 三重维度专业解读",
      "周公解梦 · 民俗意象解读",
      "一夜安寝，诸事平稳",
      "",
      "弗洛伊德 · 愿望满足理论",
      "焦虑投射，现实压力的反应",
      "",
      "荣格 · 集体无意识与原型",
      "内在自我的成长信号",
      "",
      "📜 核心寓意与重要节点指引",
      "整体寓意：提醒你关注内心",
      "必须注意的2件事",
      "- 早睡",
      "- 少熬夜",
      "",
      "💡 可落地的规避方案",
      "- 多休息",
      "- 调整作息",
      "- 适当放松",
      "",
      "💌 潜意识想对你说的真心话",
      "你一直在努力，别太苛责自己",
      "",
      "🌷 结语",
      "调整后就能顺利化解",
    ].join("\n");

    const s = extractDreamSections(text);
    expect(s.empathy).toContain("不是厄运");
    expect(s.threeViews.zhouGong).toContain("一夜安寝");
    expect(s.threeViews.freud).toContain("焦虑投射");
    expect(s.threeViews.jung).toContain("成长信号");
    expect(s.coreMeaning).toContain("整体寓意");
    expect(s.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(s.subconsciousMsg).toContain("别太苛责自己");
    expect(s.conclusion).toContain("顺利化解");
  });

  it("无 emoji 标签 → fallback 整段进 empathy", () => {
    const text = "这段没有任何标签的纯文本解读";
    const s = extractDreamSections(text);
    expect(s.empathy).toBe(text);
    expect(s.threeViews.zhouGong).toBe("");
    expect(s.threeViews.freud).toBe("");
    expect(s.threeViews.jung).toBe("");
  });

  it("部分段缺失 → 空字段", () => {
    const text = "🌙 只有一段共情\n\n🔮 三重维度专业解读\n周公解梦 · 民俗意象解读\n一夜安寝";
    const s = extractDreamSections(text);
    expect(s.empathy).toContain("只有一段共情");
    expect(s.coreMeaning).toBe("");
    expect(s.conclusion).toBe("");
  });
});
