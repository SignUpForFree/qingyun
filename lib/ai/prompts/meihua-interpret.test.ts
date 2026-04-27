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

describe("buildMeihuaPrompt (M3.22)", () => {
  it("返回 systemPrompt + userPrompt", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt.length).toBeGreaterThan(0);
    expect(r.userPrompt.length).toBeGreaterThan(0);
  });

  it("systemPrompt 含 280-450 字限制 + 4 段结构", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("280-450");
    expect(r.systemPrompt).toContain("卦象速断");
    expect(r.systemPrompt).toContain("体用");
    expect(r.systemPrompt).toContain("应期");
  });

  it("systemPrompt 含禁词锁", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.systemPrompt).toContain("禁词");
    expect(r.systemPrompt).toContain("大凶");
    expect(r.systemPrompt).toContain("命中注定");
  });

  it("userPrompt 含本卦 / 互卦 / 变卦 / 卦中卦 5 卦", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("本卦");
    expect(r.userPrompt).toContain("互卦");
    expect(r.userPrompt).toContain("变卦");
    expect(r.userPrompt).toContain("卦中卦");
  });

  it("userPrompt 含卦辞 + 彖辞 + 动爻爻辞", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("卦辞");
    expect(r.userPrompt).toContain("彖辞");
    expect(r.userPrompt).toContain("动爻");
    expect(r.userPrompt).toContain(`第 ${sampleResult.dongYao} 爻`);
  });

  it("userPrompt 含体用 + 应期", () => {
    const r = buildMeihuaPrompt({ result: sampleResult });
    expect(r.userPrompt).toContain("体卦");
    expect(r.userPrompt).toContain("用卦");
    expect(r.userPrompt).toContain("关系");
    expect(r.userPrompt).toContain("应期");
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
