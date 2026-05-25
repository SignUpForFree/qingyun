import { describe, it, expect } from "vitest";
import { buildMeihuaPrompt } from "./meihua-interpret";
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

describe("buildMeihuaPrompt (五章结构)", () => {
  it("返回 systemPrompt + userPrompt", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt.length).toBeGreaterThan(0);
    expect(r.userPrompt.length).toBeGreaterThan(0);
  });

  it("systemPrompt 含 1500-2000 字限制 + 五章结构", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("1500-2000");
    expect(r.systemPrompt).toContain("测算溯源·象数推演");
    expect(r.systemPrompt).toContain("体用生克·成败枢机");
    expect(r.systemPrompt).toContain("卦象详解·玄机洞明");
    expect(r.systemPrompt).toContain("综合断辞");
    expect(r.systemPrompt).toContain("易道指引·修心行事");
  });

  it("systemPrompt 含禁词锁", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("禁词");
    expect(r.systemPrompt).toContain("大凶");
    expect(r.systemPrompt).toContain("命中注定");
  });

  it("systemPrompt 含核心卦德'以'字结构要求", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("以");
    expect(r.systemPrompt).toContain("核心卦德");
  });

  it("systemPrompt 含固定结语", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("易为君子谋");
  });

  it("systemPrompt 含角色表+象征列要求", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("象征");
    expect(r.systemPrompt).toContain("变用卦");
  });

  it("userPrompt 含本卦 / 互卦 / 变卦", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("本卦");
    expect(r.userPrompt).toContain("互卦");
    expect(r.userPrompt).toContain("变卦");
    expect(r.userPrompt).not.toContain("卦中卦");
  });

  it("userPrompt 含卦辞 + 彖辞 + 大象传 + 动爻爻辞", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("卦辞");
    expect(r.userPrompt).toContain("彖辞");
    expect(r.userPrompt).toContain("大象传");
    expect(r.userPrompt).toContain("动爻");
    expect(r.userPrompt).toContain(`第 ${sampleResult.dongYao} 爻`);
  });

  it("userPrompt 含上下卦五行", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("本卦上卦");
    expect(r.userPrompt).toContain("本卦下卦");
    expect(r.userPrompt).toContain("互卦上卦");
    expect(r.userPrompt).toContain("互卦下卦");
    expect(r.userPrompt).toContain("变卦上卦");
    expect(r.userPrompt).toContain("变卦下卦");
  });

  it("userPrompt 含体卦 + 用卦 + 变用卦 + 应期", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("体卦");
    expect(r.userPrompt).toContain("用卦");
    expect(r.userPrompt).toContain("变用卦");
    expect(r.userPrompt).toContain("应期");
  });

  it("userPrompt 含本卦/互卦/变卦六爻爻辞", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("本卦六爻爻辞");
    expect(r.userPrompt).toContain("互卦六爻爻辞");
    expect(r.userPrompt).toContain("变卦六爻爻辞");
  });

  it("userPrompt 含起卦数字", () => {
    const r = buildMeihuaPrompt({ result: sampleResult, numbers: [3, 6, 9] });
    expect(r.userPrompt).toContain("数字起卦");
    expect(r.userPrompt).toContain("3、6、9");
  });

  it("userPrompt 含农历日期", () => {
    const r = buildMeihuaPrompt({ result: sampleResult, lunarDateText: "丙午年·三月初七·午时" });
    expect(r.userPrompt).toContain("丙午年");
  });

  it("有 hourBranch 时 userPrompt 含时辰能量行", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("时辰能量");
  });

  it("userPrompt 含五行损益 summary", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("五行损益");
  });

  it("userQuestion 同时出现在 system + user prompt 里", () => {
    const r = buildMeihuaPrompt({
      result: sampleResult,
      userQuestion: "下个月项目能不能按时上线",
    });
    expect(r.systemPrompt).toContain("下个月项目能不能按时上线");
    expect(r.userPrompt).toContain("下个月项目能不能按时上线");
  });

  it("无 hourBranch → userPrompt 不含时辰能量行", () => {
    const noTime = meihuaV2({
      numbers: [3, 6, 9],
      userQuestion: "q",
      profile: null,
    });
    const r = buildMeihuaPrompt({ result: noTime });
    expect(r.userPrompt).not.toContain("时辰能量");
  });

  it("6 爻线条以 ▬▬ / ▬ ▬ 美化", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toMatch(/▬▬|▬ ▬/);
  });

  it("不含 sunYi.adjustments 全 0 时 损益分布 行（仅在 unrelated 时）", () => {
    const noYong = meihuaV2({
      numbers: [3, 6, 9],
      userQuestion: "q",
      profile: null,
    });
    const r = buildMeihuaPrompt({ result: noYong });
    expect(r.userPrompt).toContain("五行损益"); // summary 行始终在
    expect(r.userPrompt).not.toContain("损益分布"); // delta=0 不输出
  });
});
