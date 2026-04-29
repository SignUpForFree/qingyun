import { z } from "zod";

/**
 * Onboarding 表单 schema（V2.0）
 *
 * UI/state 形态保留 V1.0 的 birth.iso/calendarType/hour/rawDate 与 region.* 字段，
 * 因为 DatePicker / RegionPicker 仍按这些形状交互。提交时通过 toProfilePatch()
 * 转换成 V2.0 profiles 表字段（birth_date / birth_time / birth_calendar / birth_place）
 * 走 PUT /api/me/profiles/[id]。
 *
 *   - birth.iso 是已经换算成公历的 ISO 字符串（带 +08:00），仅用于 UI 展示
 *   - birth.calendarType 记录用户选了哪种历法（→ birth_calendar）
 *   - birth.hour 单独记 0-23 整数或 null（"不知道" → birth_time 写 "12:00" 占位）
 *   - region.longitude/latitude V2.0 不入库（profiles 不存经纬度），但 UI 仍收集
 *     以便 RegionPicker 选择 UX
 */
export const onboardingSchema = z.object({
  nickname: z.string().min(1, "请填写昵称").max(20, "昵称最多 20 字"),
  // 注意：表单只暴露 male/female；"other" 是 M1.7 OAuth callback 写入的占位值，
  // onboarding UI 不展示该选项。
  gender: z.enum(["male", "female"], { message: "请选择性别" }),
  birth: z.object({
    iso: z.string().min(1, "请选择出生日期"),
    calendarType: z.enum(["solar", "lunar"]),
    hour: z.number().int().min(0).max(23).nullable(),
    minute: z.number().int().min(0).max(59).nullable(),
    rawDate: z.object({
      year: z.number().int(),
      month: z.number().int(),
      day: z.number().int(),
    }),
  }),
  region: z.object({
    province: z.string().min(1, "请选择省份"),
    city: z.string().min(1, "请选择城市"),
    district: z.string().optional(),
    longitude: z.number(),
    latitude: z.number(),
  }),
});

export type OnboardingForm = z.infer<typeof onboardingSchema>;

/**
 * V2.0 profiles 表 PUT 体的形态（与 lib/profile/repository.ts 的
 * UpdateProfileInput 子集一致）。提交端 PUT /api/me/profiles/[id] 用此格式。
 *
 * 注意：
 *   - gender 只有 male/female（onboarding UI 不允许 other）
 *   - birth_date 形如 "YYYY-MM-DD"，birth_time 形如 "HH:mm"
 *   - birth_place 是 "省 市" 或 "省 市 区"（区可选），多余空白会被压缩
 */
export interface ProfilePatch {
  nickname: string;
  gender: "male" | "female";
  birth_date: string;
  birth_time: string;
  birth_calendar: "solar" | "lunar";
  birth_place: string;
}

/**
 * 把 onboarding 表单转换成 V2.0 profiles PUT 体。
 *
 * 边界处理：
 *   - hour === null（"不知道时辰"）→ birth_time = "12:00"（与 M1.7 occallback 占位一致）
 *   - hour === 0（子时）→ birth_time = "00:00"（不能与 null 混淆！）
 *   - region.district 为空字符串或 undefined → birth_place 不附加 district
 *   - 多余空白通过 trim + collapse 清理
 */
export function toProfilePatch(form: OnboardingForm): ProfilePatch {
  const { year, month, day } = form.birth.rawDate;
  const birth_date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const hourValue = form.birth.hour;
  const minuteValue = form.birth.minute ?? 0;
  // null/undefined → "12:00"（"不知道时分"占位，与 M1.7 默认档保持一致）
  // 0 → "00:MM"（子时，必须区分于 null）
  const birth_time = hourValue == null
    ? "12:00"
    : `${String(hourValue).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`;

  const district = form.region.district?.trim();
  const districtPart = district ? ` ${district}` : "";
  const birth_place = `${form.region.province} ${form.region.city}${districtPart}`
    .replace(/\s+/g, " ")
    .trim();

  return {
    nickname: form.nickname,
    gender: form.gender,
    birth_date,
    birth_time,
    birth_calendar: form.birth.calendarType,
    birth_place,
  };
}

export const STEP_TITLES = [
  { step: 1, title: "你是谁", desc: "昵称与性别" },
  { step: 2, title: "你从哪来", desc: "出生时间与地点" },
  { step: 3, title: "确认信息", desc: "看一眼，提交即建档" },
] as const;
