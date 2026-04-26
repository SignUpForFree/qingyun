import { describe, it, expect } from "vitest";
import { computeYingQi } from "./ying-qi";

describe("computeYingQi — 关系决定 speed", () => {
  it("相生类 → fast", () => {
    expect(computeYingQi({ relation: "ti_sheng_yong", dongYao: 1 }).speed).toBe(
      "fast",
    );
    expect(computeYingQi({ relation: "yong_sheng_ti", dongYao: 4 }).speed).toBe(
      "fast",
    );
  });

  it("比和 → medium", () => {
    expect(computeYingQi({ relation: "bi_he", dongYao: 3 }).speed).toBe("medium");
  });

  it("相克类 → slow", () => {
    expect(computeYingQi({ relation: "ti_ke_yong", dongYao: 2 }).speed).toBe(
      "slow",
    );
    expect(computeYingQi({ relation: "yong_ke_ti", dongYao: 5 }).speed).toBe(
      "slow",
    );
  });
});

describe("computeYingQi — timeHint", () => {
  it("相生 + 动爻在下 → 『1–3 日内』", () => {
    expect(
      computeYingQi({ relation: "ti_sheng_yong", dongYao: 2 }).timeHint,
    ).toBe("1–3 日内");
  });

  it("相生 + 动爻在上 → 『本周内』", () => {
    expect(
      computeYingQi({ relation: "yong_sheng_ti", dongYao: 5 }).timeHint,
    ).toBe("本周内");
  });

  it("比和 → 『本月内』", () => {
    expect(computeYingQi({ relation: "bi_he", dongYao: 1 }).timeHint).toBe(
      "本月内",
    );
  });

  it("相克 → 『1–3 个月内』", () => {
    expect(computeYingQi({ relation: "ti_ke_yong", dongYao: 3 }).timeHint).toBe(
      "1–3 个月内",
    );
  });
});

describe("computeYingQi — branchHour 反查", () => {
  it("无 branch 输入 → branchHour 为 null", () => {
    const r = computeYingQi({ relation: "bi_he", dongYao: 1 });
    expect(r.branchHour).toBeNull();
  });

  it("传入 branch → 给出时辰范围字符串", () => {
    const r = computeYingQi({
      relation: "bi_he",
      dongYao: 1,
      bianGuaHourBranch: "卯",
    });
    expect(r.branchHour).toContain("卯");
    expect(r.branchHour).toContain("5–7");
  });

  it("子时 23–1 点", () => {
    expect(
      computeYingQi({ relation: "bi_he", dongYao: 1, bianGuaHourBranch: "子" })
        .branchHour,
    ).toContain("23");
  });

  it("午时 11–13 点", () => {
    expect(
      computeYingQi({ relation: "bi_he", dongYao: 1, bianGuaHourBranch: "午" })
        .branchHour,
    ).toContain("11");
  });
});

describe("computeYingQi — 校验", () => {
  it("dongYao 超范围抛错", () => {
    expect(() =>
      computeYingQi({ relation: "bi_he", dongYao: 0 }),
    ).toThrow();
    expect(() =>
      computeYingQi({ relation: "bi_he", dongYao: 7 }),
    ).toThrow();
  });
});
