import { describe, it, expect } from "vitest";
import { REGIONS, findProvince, findCity } from "./data";

describe("REGIONS 数据", () => {
  it("覆盖 4 个直辖市 + 27 省 + 港澳台 = 34 一级行政区", () => {
    expect(REGIONS.length).toBe(34);
  });

  it("每个省至少 1 个市", () => {
    for (const p of REGIONS) {
      expect(p.cities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("所有市的经纬度都在中国境内合理范围", () => {
    for (const p of REGIONS) {
      for (const c of p.cities) {
        expect(c.lng).toBeGreaterThan(70);
        expect(c.lng).toBeLessThan(140);
        expect(c.lat).toBeGreaterThan(15);
        expect(c.lat).toBeLessThan(55);
      }
    }
  });
});

describe("findProvince / findCity", () => {
  it("找到杭州", () => {
    const c = findCity("浙江", "杭州");
    expect(c).toBeDefined();
    expect(c?.lng).toBeCloseTo(120.1551, 3);
    expect(c?.lat).toBeCloseTo(30.2741, 3);
  });

  it("找到乌鲁木齐", () => {
    const c = findCity("新疆", "乌鲁木齐");
    expect(c?.lng).toBeCloseTo(87.6177, 3);
  });

  it("不存在的省返回 undefined", () => {
    expect(findProvince("月球")).toBeUndefined();
  });

  it("省存在但市不存在返回 undefined", () => {
    expect(findCity("北京", "通州区")).toBeUndefined();
  });

  it("北京只有 1 个市", () => {
    expect(findProvince("北京")?.cities).toHaveLength(1);
  });

  it("广东 5 个市", () => {
    expect(findProvince("广东")?.cities).toHaveLength(5);
  });
});
