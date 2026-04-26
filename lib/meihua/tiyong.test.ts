import { describe, it, expect } from "vitest";
import { judgeTiYong } from "./tiyong";

describe("judgeTiYong — 动爻位决定体用", () => {
  it("动爻 1（下卦）→ 用=下卦, 体=上卦", () => {
    const r = judgeTiYong({ upper: "乾", lower: "坤", dongYao: 1 });
    expect(r.ti).toBe("乾");
    expect(r.yong).toBe("坤");
  });

  it("动爻 4（上卦）→ 用=上卦, 体=下卦", () => {
    const r = judgeTiYong({ upper: "乾", lower: "坤", dongYao: 4 });
    expect(r.ti).toBe("坤");
    expect(r.yong).toBe("乾");
  });

  it("动爻 3 与 4 临界点正确", () => {
    expect(judgeTiYong({ upper: "兑", lower: "离", dongYao: 3 }).ti).toBe("兑");
    expect(judgeTiYong({ upper: "兑", lower: "离", dongYao: 4 }).ti).toBe("离");
  });
});

describe("judgeTiYong — relation 五种", () => {
  it("比和：体用同五行", () => {
    // 乾(金) 上 兑(金) 下，动爻 1 → 体=乾(金)，用=兑(金) → 比和
    const r = judgeTiYong({ upper: "乾", lower: "兑", dongYao: 1 });
    expect(r.relation).toBe("bi_he");
  });

  it("体生用：体木 → 用火", () => {
    // 离(火) 上 震(木) 下，动爻 4 → 用=离(火), 体=震(木) → 木生火
    const r = judgeTiYong({ upper: "离", lower: "震", dongYao: 4 });
    expect(r.ti).toBe("震");
    expect(r.yong).toBe("离");
    expect(r.relation).toBe("ti_sheng_yong");
  });

  it("用生体：用 -> 体", () => {
    // 离(火) 上 震(木) 下，动爻 1 → 体=离(火), 用=震(木) → 木生火 → 用生体
    const r = judgeTiYong({ upper: "离", lower: "震", dongYao: 1 });
    expect(r.ti).toBe("离");
    expect(r.yong).toBe("震");
    expect(r.relation).toBe("yong_sheng_ti");
  });

  it("体克用：体克用方向", () => {
    // 巽(木) 上 坤(土) 下，动爻 4 → 用=巽(木), 体=坤(土) → 木克土 → 用克体
    const r = judgeTiYong({ upper: "巽", lower: "坤", dongYao: 4 });
    expect(r.ti).toBe("坤");
    expect(r.yong).toBe("巽");
    expect(r.relation).toBe("yong_ke_ti");
  });

  it("用克体：用克体方向", () => {
    // 巽(木) 上 坤(土) 下，动爻 1 → 体=巽(木), 用=坤(土) → 木克土 → 体克用
    const r = judgeTiYong({ upper: "巽", lower: "坤", dongYao: 1 });
    expect(r.ti).toBe("巽");
    expect(r.yong).toBe("坤");
    expect(r.relation).toBe("ti_ke_yong");
  });
});

describe("judgeTiYong — 校验", () => {
  it("dongYao 超范围抛错", () => {
    expect(() =>
      judgeTiYong({ upper: "乾", lower: "坤", dongYao: 0 }),
    ).toThrow();
    expect(() =>
      judgeTiYong({ upper: "乾", lower: "坤", dongYao: 7 }),
    ).toThrow();
  });
});
