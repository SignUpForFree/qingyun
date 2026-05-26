import { describe, it, expect } from "vitest";
import { buildFortuneReadingPrompt } from "./fortune-reading";
import type { Attributes } from "@/lib/fortune/attributes";
import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";

const SAMPLE_SCORES: DimensionScores7 = {
  爱情: 75,
  财富: 80,
  事业: 78,
  学习: 70,
  健康: 72,
  人际: 76,
  心情: 74,
};

const SAMPLE_ATTRS: Attributes = {
  color: { name: "新柳绿", hex: "#BFD9C2" },
  direction: "正东",
  hour: { branch: "辰", range: "07:00–09:00" },
  numbers: [3, 8],
  number: 3,
  flower: "栀子",
  item: "一卷书",
  accessory: "玉镯 / 木珠",
  food: "绿叶蔬菜（菠菜、青菜、竹笋）",
};

describe("buildFortuneReadingPrompt (M3.28)", () => {
  it("返回 systemPrompt + userPrompt", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.systemPrompt.length).toBeGreaterThan(0);
    expect(r.userPrompt.length).toBeGreaterThan(0);
  });

  it("systemPrompt 锁 7 维度顺序", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.systemPrompt).toContain("【爱情】");
    expect(r.systemPrompt).toContain("【财富】");
    expect(r.systemPrompt).toContain("【事业】");
    expect(r.systemPrompt).toContain("【学习】");
    expect(r.systemPrompt).toContain("【健康】");
    expect(r.systemPrompt).toContain("【人际】");
    expect(r.systemPrompt).toContain("【心情】");
  });

  it("systemPrompt 含每段 60-80 字 + 7 段结构", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.systemPrompt).toContain("60-80");
    expect(r.systemPrompt).toContain("7 段");
  });

  it("systemPrompt 含禁词锁", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.systemPrompt).toContain("禁词");
    expect(r.systemPrompt).toContain("大凶");
    expect(r.systemPrompt).toContain("命中注定");
  });

  it("userPrompt 含日期 + 干支", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.userPrompt).toContain("2026-04-27");
    expect(r.userPrompt).toContain("甲子");
  });

  it("userPrompt 含 7 维度分数", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.userPrompt).toContain("爱情: 75");
    expect(r.userPrompt).toContain("财富: 80");
    expect(r.userPrompt).toContain("心情: 74");
  });

  it("userPrompt 含 8 lucky 属性", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.userPrompt).toContain("新柳绿");
    expect(r.userPrompt).toContain("正东");
    expect(r.userPrompt).toContain("07:00–09:00");
    expect(r.userPrompt).toContain("栀子");
    expect(r.userPrompt).toContain("玉镯");
  });

  it("dayMaster + yongShen 可选注入", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
      dayMaster: "辛",
      yongShen: "木",
    });
    expect(r.userPrompt).toContain("日主");
    expect(r.userPrompt).toContain("辛");
    expect(r.userPrompt).toContain("用神");
    expect(r.userPrompt).toContain("木");
  });

  it("oneLiner 注入 userPrompt", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
      oneLiner: "今天像泡了一壶不浓不淡的茶。",
    });
    expect(r.userPrompt).toContain("今天像泡了一壶不浓不淡的茶。");
  });

  it("无可选 fields 仍能跑通", () => {
    const r = buildFortuneReadingPrompt({
      date: "2026-04-27",
      dayPillar: { gan: "甲", zhi: "子" },
      scores: SAMPLE_SCORES,
      attributes: SAMPLE_ATTRS,
    });
    expect(r.userPrompt).not.toContain("日主：");
    expect(r.userPrompt).not.toContain("用神：");
    expect(r.userPrompt).not.toContain("one-liner");
  });
});
