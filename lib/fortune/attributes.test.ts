import { describe, it, expect } from "vitest";
import { computeAttributes } from "./attributes";

describe("computeAttributes", () => {
  it("甲(木) + 子(水北) → 木色 + 北方", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "甲", zhi: "子" });
    expect(a.color.name).toBe("新柳绿");
    expect(a.direction).toBe("正北");
    // 子的三合 = 辰，时辰 07:00–09:00
    expect(a.hour.branch).toBe("辰");
    expect(a.hour.range).toBe("07:00–09:00");
    expect(a.number).toBe(1); // 子 = 1
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

  it("number 1-12 对齐 12 地支序", () => {
    const a = computeAttributes({ date: "2026-04-26", gan: "甲", zhi: "亥" });
    expect(a.number).toBe(12);
  });
});
