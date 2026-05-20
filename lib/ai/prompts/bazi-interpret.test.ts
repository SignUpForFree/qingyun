import { describe, it, expect } from "vitest";
import { buildBaziPrompt } from "./bazi-interpret";
import type { BaziChartV2 } from "@/lib/bazi/chart";

const sampleChart: BaziChartV2 = {
  pillars: {
    year: { gan: "甲", zhi: "子" },
    month: { gan: "丁", zhi: "卯" },
    day: { gan: "戊", zhi: "辰" },
    hour: { gan: "庚", zhi: "申" },
  },
  fiveElements: { 金: 2, 木: 3, 水: 1, 火: 1, 土: 3 },
  dayMaster: "戊",
  tenGods: { year: "七杀", month: "正印", hour: "食神" },
  luckPillars: [
    { age: 5, gan: "戊", zhi: "辰" },
    { age: 15, gan: "己", zhi: "巳" },
    { age: 25, gan: "庚", zhi: "午" },
    { age: 35, gan: "辛", zhi: "未" },
    { age: 45, gan: "壬", zhi: "申" },
    { age: 55, gan: "癸", zhi: "酉" },
    { age: 65, gan: "甲", zhi: "戌" },
    { age: 75, gan: "乙", zhi: "亥" },
  ],
  solarTrueTime: "1984-03-15T10:00:00.000Z",
  pillarDetails: {
    year: { gan: "甲", zhi: "子", gan_wuxing: "木", zhi_wuxing: "水", yinyang: "yang", nayin: "海中金", nayinWuxing: "金" },
    month: { gan: "丁", zhi: "卯", gan_wuxing: "火", zhi_wuxing: "木", yinyang: "yin", nayin: "炉中火", nayinWuxing: "火" },
    day: { gan: "戊", zhi: "辰", gan_wuxing: "土", zhi_wuxing: "土", yinyang: "yang", nayin: "大林木", nayinWuxing: "木" },
    hour: { gan: "庚", zhi: "申", gan_wuxing: "金", zhi_wuxing: "金", yinyang: "yang", nayin: "石榴木", nayinWuxing: "木" },
    full_pillar: "甲子年 丁卯月 戊辰日 庚申时",
    day_gan: "戊",
    day_zhi: "辰",
  },
  wuxingCount: { 金: 2, 木: 3, 水: 1, 火: 1, 土: 3 },
  wuxingStats: {
    total_count: { 金: 2, 木: 3, 水: 1, 火: 1, 土: 3 },
    energy_score: { 金: 20, 木: 30, 水: 10, 火: 10, 土: 30 },
    strength_level: { 金: "弱", 木: "旺", 水: "极弱", 火: "极弱", 土: "旺" },
    proportion: { 金: "20%", 木: "30%", 水: "10%", 火: "10%", 土: "30%" },
    wuxing_feature: "木土两旺，水火极弱",
  },
  xchhResult: { working_count: { 金: 2, 木: 3, 水: 1, 火: 1, 土: 3 }, matches: [] },
  wangXiangStatus: "旺",
  finalScores: { 金: 2, 木: 3, 水: 1, 火: 1, 土: 3 },
  tenGodsFull: {
    tian_gan_ten_gods: { "年干": "七杀", "月干": "正印", "日干": "日主", "时干": "食神" },
    zhi_ten_gods: { "年支": "正财+劫财", "月支": "正官+比肩", "日支": "比肩+正财+偏官", "时支": "食神+比肩+偏财" },
    ten_gods_count: { 比肩: 3, 劫财: 1, 正印: 2, 偏印: 0, 食神: 2, 伤官: 0, 正财: 2, 偏财: 1, 正官: 1, 七杀: 1 },
    bangfu_total: 8,
    kexiehao_total: 4,
  },
  strength: {
    bangfu_total: 8, kexiehao_total: 4, yueling_bonus: 0,
    final_score: 40, strength_type: "身强", strength_desc: "日主土帮扶有力，身强偏旺",
  },
  yongShenFull: {
    xiyongshen: ["金", "水", "木"],
    yongshen: [],
    jishen: ["火", "土"],
    xianshen: [],
    tiaohou_shen: ["木", "水"],
    tongguan_wuxing: [],
    desc: "身强喜金水木，忌火土，调候用木水",
  },
  shensha: [
    { name: "天乙贵人", interpretation: "贵人扶持", polarity: "吉", categories: ["人际贵人"] },
    { name: "文昌贵人", interpretation: "学业有助", polarity: "吉", categories: ["事业学业"] },
    { name: "羊刃", interpretation: "需收敛锋芒", polarity: "凶", categories: ["平安健康"] },
    { name: "驿马", interpretation: "变动迁移", polarity: "中", categories: ["事业学业"] },
  ],
  yongShen: {
    gejuType: "中和",
    yongShen: "水",
    jiShen: null,
    strength: 50,
    reason: "命局五行偏均衡，宜补 水 调候",
  },
  dayunWithFortune: [
    { index: 1, stem: "戊", branch: "辰", pillar: "戊辰", startAge: 5, endAge: 14, fortune: "平", dayunWuxing: "土" },
    { index: 2, stem: "己", branch: "巳", pillar: "己巳", startAge: 15, endAge: 24, fortune: "凶", dayunWuxing: "土" },
    { index: 3, stem: "庚", branch: "午", pillar: "庚午", startAge: 25, endAge: 34, fortune: "吉", dayunWuxing: "金" },
    { index: 4, stem: "辛", branch: "未", pillar: "辛未", startAge: 35, endAge: 44, fortune: "吉", dayunWuxing: "金" },
    { index: 5, stem: "壬", branch: "申", pillar: "壬申", startAge: 45, endAge: 54, fortune: "吉", dayunWuxing: "水" },
    { index: 6, stem: "癸", branch: "酉", pillar: "癸酉", startAge: 55, endAge: 64, fortune: "吉", dayunWuxing: "水" },
    { index: 7, stem: "甲", branch: "戌", pillar: "甲戌", startAge: 65, endAge: 74, fortune: "平", dayunWuxing: "木" },
    { index: 8, stem: "乙", branch: "亥", pillar: "乙亥", startAge: 75, endAge: 84, fortune: "平", dayunWuxing: "木" },
  ],
  liunian: [
    { year: 2024, stem: "甲", branch: "辰", pillar: "甲辰", offset: -2, fortune: "吉" as const },
    { year: 2025, stem: "乙", branch: "巳", pillar: "乙巳", offset: -1, fortune: "平" as const },
    { year: 2026, stem: "丙", branch: "午", pillar: "丙午", offset: 0, fortune: "平" as const },
    { year: 2027, stem: "丁", branch: "未", pillar: "丁未", offset: 1, fortune: "凶" as const },
    { year: 2028, stem: "戊", branch: "申", pillar: "戊申", offset: 2, fortune: "吉" as const },
  ],
  labels: [],
  timeCorrection: {
    true_solar_time: "1984-03-15T10:00:00.000Z",
    real_hour_zhi: "巳",
    solar_term: "惊蛰",
    is_jieqi_boundary: false,
    is_zishi_boundary: false,
    leap_month: false,
  },
};

describe("buildBaziPrompt (M3.12)", () => {
  it("返回 systemPrompt + userPrompt 两部分", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.systemPrompt.length).toBeGreaterThan(0);
    expect(r.userPrompt.length).toBeGreaterThan(0);
  });

  it("systemPrompt 包含字数限制（380-520）", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.systemPrompt).toMatch(/380-520|\d{3}-\d{3}\s*字/);
  });

  it("systemPrompt 包含禁词锁", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.systemPrompt).toContain("禁词");
    expect(r.systemPrompt).toContain("大凶");
    expect(r.systemPrompt).toContain("命中注定");
  });

  it("systemPrompt 锁 focus 维度", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "事业学业" });
    expect(r.systemPrompt).toContain("事业学业");
  });

  it("userPrompt 包含命盘四柱", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.userPrompt).toContain("甲子");
    expect(r.userPrompt).toContain("丁卯");
    expect(r.userPrompt).toContain("戊辰");
    expect(r.userPrompt).toContain("庚申");
  });

  it("userPrompt 包含日主 + 五行计数", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.userPrompt).toContain("日主");
    expect(r.userPrompt).toContain("戊");
    expect(r.userPrompt).toContain("金2");
    expect(r.userPrompt).toContain("木3");
  });

  it("userPrompt 包含格局 + 用神", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.userPrompt).toContain("中和");
    expect(r.userPrompt).toContain("用神");
    expect(r.userPrompt).toContain("水");
  });

  it("userPrompt 按吉凶中拆分神煞", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.userPrompt).toContain("吉神");
    expect(r.userPrompt).toContain("天乙贵人");
    expect(r.userPrompt).toContain("文昌贵人");
    expect(r.userPrompt).toContain("需注意");
    expect(r.userPrompt).toContain("羊刃");
    expect(r.userPrompt).toContain("中性神煞");
    expect(r.userPrompt).toContain("驿马");
  });

  it("userPrompt 包含大运 8 步", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.userPrompt).toContain("大运");
    expect(r.userPrompt).toContain("戊辰");
    expect(r.userPrompt).toContain("乙亥");
    expect(r.userPrompt).toContain("(5-14)");
    expect(r.userPrompt).toContain("(75-84)");
  });

  it("userPrompt 包含流年 5 年", () => {
    const r = buildBaziPrompt({ chart: sampleChart, focus: "综合运势" });
    expect(r.userPrompt).toContain("2024=甲辰");
    expect(r.userPrompt).toContain("2026=丙午(本年)");
    expect(r.userPrompt).toContain("2028=戊申");
  });

  it("userQuestion 与 focus 并列出现在锁定标签里", () => {
    const r = buildBaziPrompt({
      chart: sampleChart,
      focus: "感情姻缘",
      userQuestion: "今年能遇到合适的人吗？",
    });
    expect(r.systemPrompt).toContain("感情姻缘");
    expect(r.systemPrompt).toContain("今年能遇到合适的人吗？");
    expect(r.userPrompt).toContain("感情姻缘");
    expect(r.userPrompt).toContain("今年能遇到合适的人吗？");
  });

  it("profile.gender + birthPlace 注入 userPrompt", () => {
    const r = buildBaziPrompt({
      chart: sampleChart,
      focus: "综合运势",
      profile: { gender: "female", birthPlace: "上海" },
    });
    expect(r.userPrompt).toContain("女");
    expect(r.userPrompt).toContain("上海");
  });

  it("无神煞时不抛错", () => {
    const minimalChart: BaziChartV2 = { ...sampleChart, shensha: [] };
    const r = buildBaziPrompt({ chart: minimalChart, focus: "综合运势" });
    expect(r.userPrompt.length).toBeGreaterThan(0);
    expect(r.userPrompt).not.toContain("吉神：");
  });

  it("jiShen 存在时输出忌神行", () => {
    const r = buildBaziPrompt({
      chart: {
        ...sampleChart,
        yongShen: {
          gejuType: "身弱",
          yongShen: "土",
          jiShen: "木",
          strength: 25,
          reason: "日主能量偏弱",
        },
      },
      focus: "综合运势",
    });
    expect(r.userPrompt).toContain("忌神");
    expect(r.userPrompt).toContain("木");
  });
});
