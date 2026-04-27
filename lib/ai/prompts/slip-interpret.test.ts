import { describe, it, expect } from "vitest";
import { buildSlipPrompt } from "./slip-interpret";

const SAMPLE_POEM = ["心定福自来", "莫问前程事", "云开见月明", "稳步自坦然"];

describe("buildSlipPrompt (M3.4)", () => {
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

  it("systemPrompt 含 4 段 + 字数 + 禁词锁", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "心定福自来",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(r.systemPrompt).toContain("4 段");
    expect(r.systemPrompt).toContain("300-500");
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
    const xiaXia = buildSlipPrompt({
      slipNumber: 99,
      level: "下下",
      title: "y",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(upUp.systemPrompt).toContain("上上");
    expect(upUp.systemPrompt).toContain("祝福");
    expect(xiaXia.systemPrompt).toContain("下下");
    expect(xiaXia.systemPrompt).toContain("善意提醒");
    // 下下 tone hint 不再造硬词（hint 内不复用"凶险"等，仅在禁词列表里出现）
    expect(xiaXia.systemPrompt).toContain("禁词");
  });

  it("中平 / 中吉 各自走自己的 hint", () => {
    const zp = buildSlipPrompt({
      slipNumber: 50,
      level: "中平",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(zp.systemPrompt).toContain("中平");
    expect(zp.systemPrompt).toContain("宜稳");

    const zj = buildSlipPrompt({
      slipNumber: 30,
      level: "中吉",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(zj.systemPrompt).toContain("中吉");
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

  it("无 userQuestion 时 userPrompt 不含相关字段", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(r.userPrompt).not.toContain("用户具体问题");
  });

  it("userPrompt 含 [开场 → 4 段意象 → 收尾] 结构指令", () => {
    const r = buildSlipPrompt({
      slipNumber: 1,
      level: "上上",
      title: "x",
      poemLines: SAMPLE_POEM,
      category: "事业学业",
      reading: "ok",
    });
    expect(r.userPrompt).toContain("4 段意象");
    expect(r.userPrompt).toContain("300-500");
  });
});
