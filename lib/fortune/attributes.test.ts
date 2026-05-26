import { describe, it, expect } from "vitest";
import { computeAttributes } from "./attributes";

describe("computeAttributes", () => {
  // V2: 无 chart 参数时回退到日干五行
  it("甲(木) + 子(水北) → 木色 + 北方（无 chart 回退）", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "甲", zhi: "子" });
    expect(a.color.name).toBe("新柳绿");
    expect(a.direction).toBe("正北");
    expect(a.hour.branch).toBe("辰");
    expect(a.hour.range).toBe("07:00–09:00");
    // 幸运数字来自木=[3,8]，随机1-2个
    expect(a.numbers.length).toBeGreaterThanOrEqual(1);
    expect(a.numbers.every((n) => [3, 8].includes(n))).toBe(true);
    expect(a.number).toBe(a.numbers[0]);
    expect(a.flower).toBe("栀子");
  });

  it("丙(火) + 午(火南) → 火色 + 南方", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "丙", zhi: "午" });
    expect(a.color.name).toBe("胭脂粉");
    expect(a.direction).toBe("正南");
    expect(a.flower).toBe("玫瑰");
  });

  it("辛(金) + 酉(金西) → 金色 + 西方 + 时辰丑", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "辛", zhi: "酉" });
    expect(a.color.hex).toBe("#E8D4E8");
    expect(a.direction).toBe("正西");
    expect(a.hour.branch).toBe("丑");
  });

  it("幸运数字基于日干五行（无 chart 回退模式）", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "甲", zhi: "亥" });
    // 甲=木，木数字=[3,8]
    expect(a.numbers.length).toBeGreaterThanOrEqual(1);
    expect(a.numbers.every((n) => [3, 8].includes(n))).toBe(true);
    expect(a.number).toBe(a.numbers[0]);
  });

  it("幸运数字随机1-2个且日期稳定", () => {
    const a1 = computeAttributes({ date: "2026-05-20", gan: "甲", zhi: "子" });
    const a2 = computeAttributes({ date: "2026-05-20", gan: "甲", zhi: "子" });
    // 同一天同参数，结果一致
    expect(a1.numbers).toEqual(a2.numbers);
  });

  it("副时辰 subHour 存在且有效", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "甲", zhi: "子" });
    // 子→三合=辰(主)，副=申
    expect(a.subHour).toBeDefined();
    expect(a.subHour!.branch).toBeTruthy();
    expect(a.subHour!.range).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
  });

  it("8 属性都返回非空值", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "庚", zhi: "午" });
    expect(a.color).toBeDefined();
    expect(a.direction).toBeTruthy();
    expect(a.hour).toBeDefined();
    expect(a.numbers.length).toBeGreaterThanOrEqual(1);
    expect(a.number).toBeTypeOf("number");
    expect(a.flower).toBeTruthy();
    expect(a.item).toBeTruthy();
    expect(a.accessory).toBeTruthy();
    expect(a.food).toBeTruthy();
  });

  it("金日 accessory 含银 / 玉", () => {
    const a = computeAttributes({ date: "x", gan: "庚", zhi: "午" });
    expect(a.accessory).toMatch(/银|玉/);
  });

  it("木日 food 含绿 / 青 / 蔬", () => {
    const a = computeAttributes({ date: "x", gan: "甲", zhi: "子" });
    expect(a.food).toMatch(/绿|青|蔬/);
  });

  it("水日 accessory 含黑 / 珍珠", () => {
    const a = computeAttributes({ date: "x", gan: "壬", zhi: "子" });
    expect(a.accessory).toMatch(/黑|珍珠/);
  });
});