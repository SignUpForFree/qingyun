import { describe, it, expect } from "vitest";
import { buildSlipPrompt, extractSlipSections } from "./slip-interpret";

const SAMPLE_POEM = ["心定福自来", "莫问前程事", "云开见月明", "稳步自坦然"];

describe("buildSlipPrompt", () => {
  it("返回 systemPrompt + userPrompt", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "心定福自来",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "稳中有进，心定才能福至。",
    });
    expect(r.systemPrompt.length).toBeGreaterThan(0);
    expect(r.userPrompt.length).toBeGreaterThan(0);
  });

  it("systemPrompt 含禁词锁", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "心定福自来",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(r.systemPrompt).toContain("禁词");
    expect(r.systemPrompt).toContain("大凶");
    expect(r.systemPrompt).toContain("命中注定");
    expect(r.systemPrompt).toContain("慎行");
  });

  it("systemPrompt 注入 level tone hint", () => {
    const upUp = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    const shenXing = buildSlipPrompt({
      slipNumber: 99,
      level: "慎行",
      title: "y",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(upUp.systemPrompt).toContain("上上");
    expect(upUp.systemPrompt).toContain("祝福");
    expect(shenXing.systemPrompt).toContain("慎行");
    expect(shenXing.systemPrompt).toContain("善意提醒");
  });

  it("isFullInterpret=false → 只生成 category 对应的 1 块 + ✨ 福小运寄语", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "财运",
      reading: "ok",
      isFullInterpret: false,
    });
    expect(r.systemPrompt).toContain("只生成 2 块");
    expect(r.systemPrompt).toContain("💰 财运");
    expect(r.systemPrompt).toContain("✨ 福小运寄语");
    expect(r.systemPrompt).toContain("200-350");
  });

  it("isFullInterpret=true → 生成全部 7 块", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "财运",
      reading: "ok",
      isFullInterpret: true,
    });
    expect(r.systemPrompt).toContain("7 块");
    expect(r.systemPrompt).toContain("📊 综合运势");
    expect(r.systemPrompt).toContain("💼 事业学业");
    expect(r.systemPrompt).toContain("💰 财运");
    expect(r.systemPrompt).toContain("❤ 感情姻缘");
    expect(r.systemPrompt).toContain("🤝 人际贵人");
    expect(r.systemPrompt).toContain("🍵 平安健康");
    expect(r.systemPrompt).toContain("✨ 福小运寄语");
    expect(r.systemPrompt).toContain("700-1000");
  });

  it("userPrompt 含签号 + 签名 + 等级 + 4 行签诗", () => {
    const r = buildSlipPrompt({
      slipNumber: 7,
      level: "上吉",
      title: "云开月现",
      poemLines: SAMPLE_POEM,
      category: "感情姻缘",
      reading: "稳，慢慢来。",
    });
    expect(r.userPrompt).toContain("第 7 签");
    expect(r.userPrompt).toContain("上吉");
    expect(r.userPrompt).toContain("《云开月现》");
    for (const line of SAMPLE_POEM) {
      expect(r.userPrompt).toContain(line);
    }
  });

  it("userPrompt 含 category + reading", () => {
    const r = buildSlipPrompt({
      slipNumber: 7,
      level: "上吉",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "财运",
      reading: "稳中有变，宜守不宜进。",
    });
    expect(r.userPrompt).toContain("财运");
    expect(r.userPrompt).toContain("稳中有变，宜守不宜进。");
  });

  it("userQuestion 注入 userPrompt（可选）", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
      userQuestion: "我下个月要不要换工作？",
    });
    expect(r.userPrompt).toContain("我下个月要不要换工作？");
    expect(r.userPrompt).toContain("用户具体问题");
  });
});

describe("extractSlipSections", () => {
  it("完整 7 块解析", () => {
    const text = [
      "📊 综合运势",
      "今日整体运势极佳，心态安稳则万事顺遂。",
      "",
      "这支上上签，是给你最温柔的底气。按自己的节奏来，事情就会顺理成章地往好的方向走。",
      "",
      "💼 事业学业",
      "事业稳步上扬，思路清晰，执行顺畅。",
      "",
      "今天你的状态非常在线，适合推进重要项目。只要稳扎稳打，成果一定会超出预期。",
      "",
      "💰 财运",
      "正财旺盛，收入稳定。",
      "",
      "一分耕耘一分收获，踏实做好本职工作，财富自然会来。",
      "",
      "❤ 感情姻缘",
      "感情和顺甜蜜。",
      "",
      "单身的朋友，今天很容易遇到让你心动的正缘。有伴的朋友，和伴侣心意相通。",
      "",
      "🤝 人际贵人",
      "人缘极佳，沟通顺畅。",
      "",
      "遇到困难时，会有贵人主动出手相助，帮你少走很多弯路。",
      "",
      "🍵 平安健康",
      "身心安稳舒畅。",
      "",
      "适合做一些放松的事，好好滋养自己，让身心都得到休息。",
      "",
      "✨ 福小运寄语",
      "心定福自来，从容行万里。",
    ].join("\n");

    const sections = extractSlipSections(text);
    expect(sections.length).toBe(7);
    expect(sections[0].label).toBe("综合运势");
    expect(sections[0].shortReading).toContain("整体运势极佳");
    expect(sections[0].longReading).toContain("温柔的底气");
    expect(sections[1].label).toBe("事业学业");
    expect(sections[6].label).toBe("福小运寄语");
    expect(sections[6].shortReading).toContain("心定福自来");
  });

  it("部分解读（2 块）", () => {
    const text = [
      "💰 财运",
      "正财旺盛，收入稳定。",
      "",
      "一分耕耘一分收获，踏实做好本职工作，财富自然会来。",
      "",
      "✨ 福小运寄语",
      "守得住财运，福气更长久。",
    ].join("\n");

    const sections = extractSlipSections(text);
    expect(sections.length).toBe(2);
    expect(sections[0].label).toBe("财运");
    expect(sections[1].label).toBe("福小运寄语");
  });

  it("无 emoji 标签 → fallback 整段作为综合运势", () => {
    const text = "这段没有任何标签的纯文本解读";
    const sections = extractSlipSections(text);
    expect(sections.length).toBe(1);
    expect(sections[0].label).toBe("综合运势");
    expect(sections[0].longReading).toContain("纯文本解读");
  });
});
