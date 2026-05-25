import { describe, it, expect } from "vitest";
import { castByNumbers } from "./cast";
import { interpretMeihua } from "./interpret";

describe("interpretMeihua — 全链路", () => {
  it("数字起卦 (1, 2, 3) 跑完整套推演", () => {
    const cast = castByNumbers(1, 2, 3);
    const r = interpretMeihua(cast);

    // 本卦 = 乾上兑下 = 履（10）
    expect(r.ben).toMatchObject({ number: 10, upper: "乾", lower: "兑" });
    expect(r.dongYao).toBe(3);

    // 互/变都有 number + name
    expect(r.hu.number).toBeGreaterThanOrEqual(1);
    expect(r.bian.number).toBeGreaterThanOrEqual(1);

    // tiYong + yingQi
    expect(["bi_he", "ti_ke_yong", "yong_ke_ti", "ti_sheng_yong", "yong_sheng_ti"]).toContain(
      r.tiYong.relation,
    );
    expect(["fast", "medium", "slow"]).toContain(r.yingQi.speed);

    expect(r.method).toBe("number-3");
  });

  it("乾为天 + 动爻 1 → 变卦 = 巽下乾上 = 姤（44）", () => {
    const cast = castByNumbers(1, 1, 1); // upper=1=乾, lower=1=乾, dong=1
    const r = interpretMeihua(cast);
    expect(r.ben).toMatchObject({ number: 1 });
    // 变卦：底爻翻转 → 巽下乾上
    expect(r.bian.upper).toBe("乾");
    expect(r.bian.lower).toBe("巽");
    expect(r.bian.number).toBe(44);
  });

  it("传入 hourBranch 应期带具体时辰", () => {
    const cast = castByNumbers(2, 3, 4); // 兑上离下 动 4
    const r = interpretMeihua(cast, "卯");
    expect(r.yingQi.branchHour).toContain("卯");
  });

  it("不传 hourBranch 应期 branchHour=null", () => {
    const cast = castByNumbers(2, 3, 4);
    const r = interpretMeihua(cast);
    expect(r.yingQi.branchHour).toBeNull();
  });
});
