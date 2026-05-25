import { describe, it, expect } from "vitest";
import { meihuaV2 } from "./meihua-v2";
import type { Profile } from "@/lib/db/schema";

const mockProfile: Pick<Profile, "id" | "gender" | "birth_date" | "birth_time" | "bazi_pillars"> = {
  id: "p-test",
  gender: "male",
  birth_date: "1995-03-22",
  birth_time: "09:00",
  bazi_pillars: null,
};

describe("meihuaV2 (M3.17)", () => {
  it("3 数字 → ben + hu + bian + dongYao(1-6)", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(r.ben).toBeDefined();
    expect(r.hu).toBeDefined();
    expect(r.bian).toBeDefined();
    expect(r.dongYao).toBeGreaterThanOrEqual(1);
    expect(r.dongYao).toBeLessThanOrEqual(6);
  });

  it("ben 含上下卦 + lines 6 阴阳数组", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(r.ben.upper).toBeTruthy();
    expect(r.ben.lower).toBeTruthy();
    expect(r.ben.lines).toHaveLength(6);
    for (const yao of r.ben.lines) {
      expect(typeof yao).toBe("boolean");
    }
  });

  it("tiYong 含合法 relation + ti/yong 五行", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(r.tiYong).toBeDefined();
    expect([
      "ti_ke_yong",
      "yong_ke_ti",
      "ti_sheng_yong",
      "yong_sheng_ti",
      "bi_he",
    ]).toContain(r.tiYong.relation);
  });

  it("yingQi 含合法 speed", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(["fast", "medium", "slow"]).toContain(r.yingQi.speed);
  });

  it("benDict 从 gua64 字典取 panci + tuanci + 6 yaoci", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(r.benDict.name).toBeTruthy();
    expect(r.benDict.panCi.length).toBeGreaterThan(0);
    expect(r.benDict.tuanCi.length).toBeGreaterThan(0);
    expect(r.benDict.yaoCi).toHaveLength(6);
  });

  it("benDict.dongYaoCi 对应 dongYao 位的爻辞", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(r.benDict.dongYaoCi).toBeTruthy();
    expect(r.benDict.dongYaoCi).toBe(r.benDict.yaoCi[r.dongYao - 1]);
  });

  it("时间起卦（不传 numbers）→ method=time", () => {
    const r = meihuaV2({
      date: new Date("2026-04-27T09:00:00+08:00"),
      hourBranch: "巳",
      userQuestion: "q",
      profile: mockProfile,
    });
    expect(r.method).toBe("time");
  });

  it("无 hourBranch → timeEnergy=null", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(r.timeEnergy).toBeNull();
  });

  it("有 hourBranch → timeEnergy 含 dominantWuxing 和 alignment", () => {
    const r = meihuaV2({
      numbers: [3, 6, 9],
      hourBranch: "午",
      userQuestion: "q",
      profile: mockProfile,
    });
    expect(r.timeEnergy).not.toBeNull();
    expect(r.timeEnergy!.dominantWuxing).toBe("火");
    expect(["aligned", "neutral", "conflict"]).toContain(r.timeEnergy!.alignment);
  });

  it("sunYi 含 6 维度 adjustments + relation", () => {
    const r = meihuaV2({ numbers: [3, 6, 9], userQuestion: "q", profile: mockProfile });
    expect(r.sunYi.adjustments).toHaveLength(6);
    expect(["support", "drain", "clash", "unrelated"]).toContain(r.sunYi.yongShenRelation);
  });

  it("profile=null 不抛错（M3.20 才用 profile）", () => {
    const r = meihuaV2({ numbers: [1, 2, 3], userQuestion: "q", profile: null });
    expect(r.ben).toBeDefined();
  });

  it("纯随机性：相同输入产生相同结果（确定性算法）", () => {
    const r1 = meihuaV2({ numbers: [7, 7, 7], userQuestion: "q", profile: mockProfile });
    const r2 = meihuaV2({ numbers: [7, 7, 7], userQuestion: "q", profile: mockProfile });
    expect(r1.ben.upper).toBe(r2.ben.upper);
    expect(r1.ben.lower).toBe(r2.ben.lower);
    expect(r1.dongYao).toBe(r2.dongYao);
  });
});
