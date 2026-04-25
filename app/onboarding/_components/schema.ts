import { z } from "zod";

/**
 * Onboarding 表单 schema
 *
 * 提交格式与 spec §6.4.M1 一致：
 *   - birth.iso 是已经换算成公历的 ISO 字符串（带 +08:00）
 *   - birth.calendarType 记录用户选了哪种历法（用于回显 + bazi_charts.raw 留痕）
 *   - birth.hour 单独记 0-23 整数或 null（"不知道" → null，按子时计算）
 *   - region.longitude/latitude 为市政府坐标，区/县不影响经度精度
 */
export const onboardingSchema = z.object({
  nickname: z.string().min(1, "请填写昵称").max(20, "昵称最多 20 字"),
  gender: z.enum(["male", "female"], { message: "请选择性别" }),
  birth: z.object({
    iso: z.string().min(1, "请选择出生日期"),
    calendarType: z.enum(["solar", "lunar"]),
    hour: z.number().int().min(0).max(23).nullable(),
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

export const STEP_TITLES = [
  { step: 1, title: "你是谁", desc: "昵称与性别" },
  { step: 2, title: "你从哪来", desc: "出生时间与地点" },
  { step: 3, title: "确认信息", desc: "看一眼，提交即建档" },
] as const;
