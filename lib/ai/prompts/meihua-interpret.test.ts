import { describe, it, expect } from "vitest";
import {
  buildMeihuaPrompt,
  formatGregorianDateTime,
} from "./meihua-interpret";
import { meihuaV2 } from "@/lib/divination/meihua-v2";

const sampleResult = meihuaV2({
  numbers: [3, 6, 9],
  hourBranch: "午",
  userQuestion: "下个月项目能不能按时上线",
  profile: {
    id: "p-test",
    gender: "male",
    birth_date: "1995-03-22",
    birth_time: "09:00",
    bazi_pillars: null,
  },
});

describe("buildMeihuaPrompt (测算结果解读结构)", () => {
  it("返回 systemPrompt + userPrompt", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt.length).toBeGreaterThan(0);
    expect(r.userPrompt.length).toBeGreaterThan(0);
  });

  it("systemPrompt 含新五段结构（核心结论前置）", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("测算结果解读");
    expect(r.systemPrompt).toContain("一、卦象概括");
    expect(r.systemPrompt).toContain("二、测算溯源 · 象数推演");
    expect(r.systemPrompt).toContain("三、体用生克 · 成败枢机");
    expect(r.systemPrompt).toContain("四、卦象详解 · 玄机洞明");
    expect(r.systemPrompt).toContain("五、建议指引");
    expect(r.systemPrompt).toContain("### 本卦");
    expect(r.systemPrompt).toContain("### 互卦 {{");
    expect(r.systemPrompt).not.toContain("本卦 · {{");
  });

  it("systemPrompt 含 Markdown 结构要求与自检清单", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("严格遵守Markdown排版规范");
    expect(r.systemPrompt).toContain("最终输出前自检清单");
    expect(r.systemPrompt).toContain("大吉");
    expect(r.systemPrompt).toContain("大凶");
    expect(r.systemPrompt).toContain("淬炼");
  });

  it("systemPrompt 含女修人设、去 AI 味与 300-500 字详解", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("亲和的女修");
    expect(r.systemPrompt).toContain("去掉AI味");
    expect(r.systemPrompt).toContain("### 本卦");
    expect(r.systemPrompt).toContain("体卦、变卦、变用卦的状况");
    expect(r.systemPrompt).toContain("控制在300-500字");
  });

  it("userPrompt 要求开篇结论、体用分析与 300-500 字详解", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("卦象概括");
    expect(r.userPrompt).toContain("300-500 字");
    expect(r.userPrompt).toContain("亲和女修");
    expect(r.userPrompt).toContain("变用卦");
  });

  it("不再使用旧版综合断辞 / 易道指引结语", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).not.toContain("综合断辞");
    expect(r.systemPrompt).not.toContain("易为君子谋");
  });

  it("userPrompt 含本卦 / 互卦 / 变卦", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("本卦");
    expect(r.userPrompt).toContain("互卦");
    expect(r.userPrompt).toContain("变卦");
    expect(r.userPrompt).not.toContain("卦中卦");
  });

  it("userPrompt 含公历测算时间与报数", () => {
    const r = buildMeihuaPrompt({
      result: sampleResult,
      numbers: [3, 6, 9],
      measuredAtText: "2026年5月19日 16:30",
    });
    expect(r.userPrompt).toContain("2026年5月19日 16:30");
    expect(r.userPrompt).toContain("【数字1】3");
    expect(r.userPrompt).toContain("【数字2】6");
    expect(r.userPrompt).toContain("【数字3】9");
  });

  it("formatGregorianDateTime 输出公历格式", () => {
    const t = formatGregorianDateTime(new Date("2026-05-19T08:30:00Z"));
    expect(t).toMatch(/2026年5月19日/);
    expect(t).toContain("16:30");
  });

  it("userPrompt 含卦辞 + 体用 + 应期", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("卦辞");
    expect(r.userPrompt).toContain("体卦象");
    expect(r.userPrompt).toContain("应期");
  });

  it("userQuestion 出现在 system + user prompt", () => {
    const r = buildMeihuaPrompt({
      result: sampleResult,
      userQuestion: "下个月项目能不能按时上线",
    });
    expect(r.systemPrompt).toContain("下个月项目能不能按时上线");
    expect(r.userPrompt).toContain("下个月项目能不能按时上线");
  });
});
