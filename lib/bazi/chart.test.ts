import { describe, it, expect } from "vitest";
import { buildChart } from "./chart";
import { TEN_STEMS, TWELVE_BRANCHES } from "./stems-branches";

describe("buildChart - 案例 1: 1990-06-15 14:30 杭州 男 (self-consistency baseline)", () => {
  const chart = buildChart({
    birthTime: new Date("1990-06-15T14:30:00+08:00"),
    longitude: 120.1551,
    latitude: 30.2741,
    gender: "male",
    calendarType: "solar",
  });

  it("四柱完整（gan ∈ 10 天干, zhi ∈ 12 地支）", () => {
    for (const p of [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]) {
      expect(TEN_STEMS).toContain(p.gan);
      expect(TWELVE_BRANCHES).toContain(p.zhi);
    }
  });

  it("年柱 = 庚午（1990 年 lunar-javascript 实测）", () => {
    expect(chart.pillars.year).toEqual({ gan: "庚", zhi: "午" });
  });

  it("dayMaster === pillars.day.gan", () => {
    expect(chart.dayMaster).toBe(chart.pillars.day.gan);
  });

  it("五行总和 = 8（4 柱 × 2 字）", () => {
    const total = Object.values(chart.fiveElements).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  it("十神含 year/month/hour 3 项（日主自身不计）", () => {
    expect(chart.tenGods.year).toBeDefined();
    expect(chart.tenGods.month).toBeDefined();
    expect(chart.tenGods.hour).toBeDefined();
  });

  it("大运 8 步, 每步 startAge ≥ 1 且 gan/zhi 合法", () => {
    expect(chart.luckPillars).toHaveLength(8);
    for (const l of chart.luckPillars) {
      expect(l.age).toBeGreaterThanOrEqual(1);
      expect(TEN_STEMS).toContain(l.gan);
      expect(TWELVE_BRANCHES).toContain(l.zhi);
    }
  });

  it("大运起步年龄递增（差 10 年）", () => {
    for (let i = 1; i < chart.luckPillars.length; i++) {
      const prev = chart.luckPillars[i - 1].age;
      const curr = chart.luckPillars[i].age;
      expect(curr - prev).toBe(10);
    }
  });

  it("solarTrueTime 是 ISO 字符串且偏移约 +0.62 分钟", () => {
    const trueTime = new Date(chart.solarTrueTime);
    const original = new Date("1990-06-15T14:30:00+08:00");
    const diffMin = (trueTime.getTime() - original.getTime()) / 60_000;
    expect(diffMin).toBeCloseTo(0.62, 1);
  });
});

describe("buildChart - 性别不同时大运方向不同", () => {
  it("男 vs 女 案例 1 大运首步 GanZhi 通常不同（顺逆排）", () => {
    const input = {
      birthTime: new Date("1990-06-15T14:30:00+08:00"),
      longitude: 120.1551,
      latitude: 30.2741,
      calendarType: "solar" as const,
    };
    const male = buildChart({ ...input, gender: "male" });
    const female = buildChart({ ...input, gender: "female" });
    // 阳男阴女顺排, 阴男阳女逆排 — 1990 庚年是阳, 男顺女逆
    // 至少 dayMaster 同（同一时刻），但首步大运 GanZhi 一般不同
    expect(male.dayMaster).toBe(female.dayMaster);
    const maleFirst = male.luckPillars[0];
    const femaleFirst = female.luckPillars[0];
    expect(`${maleFirst.gan}${maleFirst.zhi}`).not.toBe(`${femaleFirst.gan}${femaleFirst.zhi}`);
  });
});

describe("buildChart - 农历输入路径", () => {
  it.skip("农历 2000-01-01 06:00 上海 女（待用户提供权威排盘后启用）", () => {
    // P1 阶段：lunar 路径已实现，但 ground truth 待补
  });
});

describe("buildChart - 跨夜子时", () => {
  it.skip("公历 1985-12-31 23:45 北京 男（子时归属，待用户提供权威排盘后启用）", () => {
    // P1 阶段：先 skip，等用户提供权威 App 排盘对照
  });
});

describe("buildChart - 不变性", () => {
  it("不修改输入 birthTime", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const originalIso = t.toISOString();
    buildChart({
      birthTime: t,
      longitude: 120.1551,
      latitude: 30.2741,
      gender: "male",
      calendarType: "solar",
    });
    expect(t.toISOString()).toBe(originalIso);
  });
});

import { buildChartV2 } from "./chart";

describe("buildChartV2 - 整合 神煞 + 流年 + 用神 (M3.11)", () => {
  const chart = buildChartV2({
    birthTime: new Date("1990-06-15T14:30:00+08:00"),
    longitude: 120.1551,
    latitude: 30.2741,
    gender: "male",
    calendarType: "solar",
  });

  it("继承 BaziComputed 字段", () => {
    expect(chart.pillars.year).toEqual({ gan: "庚", zhi: "午" });
    expect(chart.dayMaster).toBe(chart.pillars.day.gan);
    expect(chart.luckPillars).toHaveLength(8);
  });

  it("shensha 数组（V2.0 任意命局至少命中数条）", () => {
    expect(Array.isArray(chart.shensha)).toBe(true);
    expect(chart.shensha.length).toBeGreaterThan(0);
    for (const s of chart.shensha) {
      expect(["吉", "凶", "中"]).toContain(s.polarity);
      expect(s.categories.length).toBeGreaterThan(0);
    }
  });

  it("yongShen 字段完整", () => {
    expect(["金", "木", "水", "火", "土"]).toContain(chart.yongShen.yongShen);
    expect(["身强", "身弱", "中和", "从弱", "从强"]).toContain(chart.yongShen.gejuType);
    expect(chart.yongShen.strength).toBeGreaterThanOrEqual(0);
    expect(chart.yongShen.strength).toBeLessThanOrEqual(100);
  });

  it("liunian 5 年（前 2 当 1 后 2）", () => {
    expect(chart.liunian).toHaveLength(5);
    const center = chart.liunian[2];
    expect(center.offset).toBe(0);
  });

  it("centerYear 自定义", () => {
    const c2 = buildChartV2(
      {
        birthTime: new Date("1990-06-15T14:30:00+08:00"),
        longitude: 120.1551,
        latitude: 30.2741,
        gender: "male",
        calendarType: "solar",
      },
      { centerYear: 2030 },
    );
    expect(c2.liunian[2].year).toBe(2030);
  });
});
