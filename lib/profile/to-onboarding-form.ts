import "server-only";
import type { Profile } from "@/lib/db/schema";
import type { OnboardingForm } from "@/app/onboarding/_components/schema";
import { findCity } from "@/lib/regions/data";

/**
 * 把 V2.0 profile 行回填到 onboarding 表单形态。
 *
 * 用于 /me/edit、/me/profiles/[id]/edit、/me/profiles/new 复用 OnboardingClient。
 * 占位档（gender="other"、birth_place="未填"）会返回部分字段，让 wizard 从 step1 开始填。
 *
 * 边界：
 *   - birth_time "12:00" 与 hour=null 互译（与 toProfilePatch 对称）
 *   - birth_place "省 市 [区]" 按空白 split；找不到城市经纬度时用 0,0 占位
 *   - gender="other" 不能直接回填（onboarding UI 只支持 male/female），返回 undefined
 */
export function profileToOnboardingForm(p: Profile): Partial<OnboardingForm> {
  const out: Partial<OnboardingForm> = {};

  if (p.nickname && p.nickname !== "我") {
    out.nickname = p.nickname;
  }

  if (p.gender === "male" || p.gender === "female") {
    out.gender = p.gender;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.birth_date);
  if (dateMatch && p.birth_date !== "1990-01-01") {
    const [, y, m, d] = dateMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    let hour: number | null = null;
    let minute: number | null = null;
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(p.birth_time);
    if (timeMatch) {
      const h = Number(timeMatch[1]);
      const mm = Number(timeMatch[2]);
      if (p.birth_time === "12:00") {
        hour = null;
        minute = null;
      } else {
        hour = h;
        minute = mm;
      }
    }
    out.birth = {
      iso: `${p.birth_date}T${p.birth_time}:00+08:00`,
      calendarType: p.birth_calendar === "lunar" ? "lunar" : "solar",
      hour,
      minute,
      rawDate: { year, month, day },
    };
  }

  if (p.birth_place && p.birth_place !== "未填") {
    const parts = p.birth_place.split(/\s+/).filter(Boolean);
    const province = parts[0] ?? "";
    const city = parts[1] ?? "";
    const district = parts[2];
    const cityRow = findCity(province, city);
    out.region = {
      province,
      city,
      district,
      longitude: cityRow?.lng ?? 0,
      latitude: cityRow?.lat ?? 0,
    };
  }

  return out;
}
