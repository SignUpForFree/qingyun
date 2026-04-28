import { describe, it, expect } from "vitest";
import { profileToOnboardingForm } from "./to-onboarding-form";
import type { Profile } from "@/lib/db/schema";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "p-1",
    user_id: "u-1",
    is_default: true,
    nickname: "云水",
    avatar_url: null,
    gender: "female",
    birth_date: "1995-03-08",
    birth_time: "10:00",
    birth_calendar: "solar",
    birth_place: "上海 上海市",
    current_address: null,
    bazi_pillars: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("profileToOnboardingForm", () => {
  it("完整 profile → 完整 OnboardingForm", () => {
    const form = profileToOnboardingForm(makeProfile());
    expect(form.nickname).toBe("云水");
    expect(form.gender).toBe("female");
    expect(form.birth?.calendarType).toBe("solar");
    expect(form.birth?.hour).toBe(10);
    expect(form.birth?.rawDate).toEqual({ year: 1995, month: 3, day: 8 });
    expect(form.region?.province).toBe("上海");
    expect(form.region?.city).toBe("上海市");
  });

  it("birth_time=12:00 → hour=null（占位回译）", () => {
    const form = profileToOnboardingForm(makeProfile({ birth_time: "12:00" }));
    expect(form.birth?.hour).toBeNull();
  });

  it("birth_time=00:00 → hour=0（子时不丢）", () => {
    const form = profileToOnboardingForm(makeProfile({ birth_time: "00:00" }));
    expect(form.birth?.hour).toBe(0);
  });

  it("gender=other（OAuth 占位）→ 不回填", () => {
    const form = profileToOnboardingForm(makeProfile({ gender: "other" }));
    expect(form.gender).toBeUndefined();
  });

  it("nickname='我' 占位 → 不回填", () => {
    const form = profileToOnboardingForm(makeProfile({ nickname: "我" }));
    expect(form.nickname).toBeUndefined();
  });

  it("birth_place='未填' 占位 → 不回填 region", () => {
    const form = profileToOnboardingForm(makeProfile({ birth_place: "未填" }));
    expect(form.region).toBeUndefined();
  });

  it("birth_date=1990-01-01 占位 → 不回填 birth", () => {
    const form = profileToOnboardingForm(makeProfile({ birth_date: "1990-01-01" }));
    expect(form.birth).toBeUndefined();
  });

  it("birth_place 含 district → 拆出 district 字段", () => {
    const form = profileToOnboardingForm(
      makeProfile({ birth_place: "上海 上海市 浦东新区" }),
    );
    expect(form.region?.province).toBe("上海");
    expect(form.region?.city).toBe("上海市");
    expect(form.region?.district).toBe("浦东新区");
  });

  it("农历 → calendarType=lunar", () => {
    const form = profileToOnboardingForm(makeProfile({ birth_calendar: "lunar" }));
    expect(form.birth?.calendarType).toBe("lunar");
  });

  it("找不到城市经纬度 → fallback 0,0（不爆错）", () => {
    const form = profileToOnboardingForm(
      makeProfile({ birth_place: "外星 外星市" }),
    );
    expect(form.region?.longitude).toBe(0);
    expect(form.region?.latitude).toBe(0);
  });
});
