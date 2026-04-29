import { describe, expect, it } from "vitest";
import { toProfilePatch, type OnboardingForm } from "./schema";

/**
 * M1.11: V2.0 提交体转换的边界用例
 *
 * 每个用例都新建独立 form 对象（immutable 风格），不复用 mutating 模板。
 */
function makeForm(overrides: Partial<OnboardingForm> = {}): OnboardingForm {
  const base: OnboardingForm = {
    nickname: "云水",
    gender: "female",
    birth: {
      iso: "1995-03-08T10:00:00+08:00",
      calendarType: "solar",
      hour: 10,
      minute: 0,
      rawDate: { year: 1995, month: 3, day: 8 },
    },
    region: {
      province: "上海",
      city: "上海市",
      district: undefined,
      longitude: 121.4737,
      latitude: 31.2304,
    },
  };
  return {
    ...base,
    ...overrides,
    birth: { ...base.birth, ...(overrides.birth ?? {}) },
    region: { ...base.region, ...(overrides.region ?? {}) },
  };
}

describe("toProfilePatch", () => {
  it("公历 + 完整字段 → V2.0 PUT 体（不含经纬度）", () => {
    const patch = toProfilePatch(makeForm());
    expect(patch).toEqual({
      nickname: "云水",
      gender: "female",
      birth_date: "1995-03-08",
      birth_time: "10:00",
      birth_calendar: "solar",
      birth_place: "上海 上海市",
    });
    // 经纬度不应进入 PUT 体（V2.0 schema 不存储）
    expect(patch).not.toHaveProperty("longitude");
    expect(patch).not.toHaveProperty("latitude");
  });

  it("农历 → birth_calendar 保留 lunar", () => {
    const patch = toProfilePatch(
      makeForm({
        birth: {
          iso: "1995-03-08T10:00:00+08:00",
          calendarType: "lunar",
          hour: 10,
          minute: 0,
          rawDate: { year: 1995, month: 2, day: 7 },
        },
      }),
    );
    expect(patch.birth_calendar).toBe("lunar");
    expect(patch.birth_date).toBe("1995-02-07");
  });

  it("hour=null（不知道时辰）→ birth_time = 12:00 占位", () => {
    const patch = toProfilePatch(
      makeForm({
        birth: {
          iso: "1995-03-08T00:00:00+08:00",
          calendarType: "solar",
          hour: null,
          minute: null,
          rawDate: { year: 1995, month: 3, day: 8 },
        },
      }),
    );
    expect(patch.birth_time).toBe("12:00");
  });

  it("hour=0（子时）→ birth_time = 00:00（不与 null 混淆）", () => {
    const patch = toProfilePatch(
      makeForm({
        birth: {
          iso: "1995-03-08T00:00:00+08:00",
          calendarType: "solar",
          hour: 0,
          minute: 0,
          rawDate: { year: 1995, month: 3, day: 8 },
        },
      }),
    );
    expect(patch.birth_time).toBe("00:00");
  });

  it("hour=23 → birth_time = 23:00（边界）", () => {
    const patch = toProfilePatch(
      makeForm({
        birth: {
          iso: "1995-03-08T23:00:00+08:00",
          calendarType: "solar",
          hour: 23,
          minute: 0,
          rawDate: { year: 1995, month: 3, day: 8 },
        },
      }),
    );
    expect(patch.birth_time).toBe("23:00");
  });

  it("region 含 district → birth_place 拼成「省 市 区」", () => {
    const patch = toProfilePatch(
      makeForm({
        region: {
          province: "上海",
          city: "上海市",
          district: "浦东新区",
          longitude: 121.5,
          latitude: 31.2,
        },
      }),
    );
    expect(patch.birth_place).toBe("上海 上海市 浦东新区");
  });

  it("region 不含 district → birth_place 拼成「省 市」", () => {
    const patch = toProfilePatch(makeForm());
    expect(patch.birth_place).toBe("上海 上海市");
  });

  it("region.district 为空字符串 → 视为无 district，不附加多余空格", () => {
    const patch = toProfilePatch(
      makeForm({
        region: {
          province: "北京",
          city: "北京市",
          district: "",
          longitude: 116.4,
          latitude: 39.9,
        },
      }),
    );
    expect(patch.birth_place).toBe("北京 北京市");
  });

  it("月/日个位数 → 补 0 至 YYYY-MM-DD", () => {
    const patch = toProfilePatch(
      makeForm({
        birth: {
          iso: "2001-01-05T10:00:00+08:00",
          calendarType: "solar",
          hour: 10,
          minute: 0,
          rawDate: { year: 2001, month: 1, day: 5 },
        },
      }),
    );
    expect(patch.birth_date).toBe("2001-01-05");
  });

  it("nickname 与 gender 直接透传", () => {
    const patch = toProfilePatch(
      makeForm({ nickname: "李明", gender: "male" }),
    );
    expect(patch.nickname).toBe("李明");
    expect(patch.gender).toBe("male");
  });
});
