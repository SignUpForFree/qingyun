import { z } from "zod";

/**
 * 23 个对话 UI 卡片类型（M2.4，spec §4.4）
 *
 * 用 discriminated union（"ui" 字段）描述 messages.metadata 的结构。
 * 后端写消息时把 metadata stringify 后存 messages 表，前端读出来再 parseCardMeta。
 *
 * 分组：
 *  - state/transient (3): intent_pending / progress_long_task / error_card
 *  - pickers (4): choice_card / profile_picker / slip_type_picker / bazi_focus_picker
 *  - forms (5): slip_question_input / bazi_quick_form / meihua_number_input / dream_fast_input / dream_precise_form
 *  - animation (1): slip_drawing
 *  - results (7): slip_image / slip_report / dream_result_fast / dream_result_precise /
 *                bazi_result / meihua_result / fortune_brief_card
 *  - auxiliary (3): summary_card / profile_added_hint / quick_action_chips
 *
 * 字段细节：本文件给最小契约（关键字段 + 占位扩展点）。
 * 完整 result schema 在对应 sub-action API（M2.16-M2.20）落地时再补强。
 */

const choiceOption = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().optional(),
});

// ============ state / transient ============

const intentPending = z.object({
  ui: z.literal("intent_pending"),
  hint: z.string().optional(),
});

const progressLongTask = z.object({
  ui: z.literal("progress_long_task"),
  etaSec: z.number().int().positive().optional(),
  stage: z.enum(["classifying", "computing", "streaming"]).optional(),
  percent: z.number().min(0).max(100).optional(),
  cancellable: z.boolean().optional(),
});

const errorCard = z.object({
  ui: z.literal("error_card"),
  message: z.string().min(1),
  code: z
    .enum(["ai_timeout", "ai_rate_limit", "user_rate_limit", "content_safety", "network", "unknown"])
    .optional(),
  retryable: z.boolean().optional(),
});

// ============ pickers ============

const choiceCard = z.object({
  ui: z.literal("choice_card"),
  question: z.string().optional(),
  options: z.array(choiceOption).min(1),
  multi: z.boolean().optional(),
});

const profilePicker = z.object({
  ui: z.literal("profile_picker"),
  profiles: z.array(
    z.object({
      id: z.string().uuid(),
      nickname: z.string(),
      isDefault: z.boolean(),
      avatarUrl: z.string().url().optional(),
      birthDate: z.string().optional(),
    }),
  ),
  allowAddNew: z.boolean().optional(),
});

const slipTypePicker = z.object({
  ui: z.literal("slip_type_picker"),
  options: z.array(choiceOption).min(1),
});

const baziFocusPicker = z.object({
  ui: z.literal("bazi_focus_picker"),
  options: z.array(choiceOption).min(1),
  profileId: z.string().uuid().optional(),
});

// ============ forms ============

const slipQuestionInput = z.object({
  ui: z.literal("slip_question_input"),
  category: z.string(),
  placeholder: z.string().optional(),
});

const baziQuickForm = z.object({
  ui: z.literal("bazi_quick_form"),
  fields: z.array(z.enum(["gender", "birth_date", "birth_time", "birth_place"])),
  reason: z.string().optional(),
});

const meihuaNumberInput = z.object({
  ui: z.literal("meihua_number_input"),
  profileId: z.string().uuid(),
  numberCount: z.number().int().min(1).max(6).default(3),
});

const dreamFastInput = z.object({
  ui: z.literal("dream_fast_input"),
});

const dreamPreciseForm = z.object({
  ui: z.literal("dream_precise_form"),
  fields: z.array(z.enum(["core", "emotion", "reality", "special"])).optional(),
});

// ============ animation ============

const slipDrawing = z.object({
  ui: z.literal("slip_drawing"),
  durationMs: z.number().int().positive().default(2000),
});

// ============ results ============

const slipImage = z.object({
  ui: z.literal("slip_image"),
  slipNumber: z.number().int().min(1).max(100),
  level: z.enum(["上上", "上吉", "吉", "平", "渐顺", "慎行"]),
  title: z.string(),
  poemLines: z.array(z.string()).length(4),
  imageUrl: z.string(),
  category: z.string().optional(),
});

const slipReport = z.object({
  ui: z.literal("slip_report"),
  slipNumber: z.number().int().min(1).max(100),
  level: z.enum(["上上", "上吉", "吉", "平", "渐顺", "慎行"]),
  title: z.string(),
  poem: z.string(),
  dimension: z.string(),
  reading: z.string(),
  aiInterpretation: z.string(),
});

const dreamResultFast = z.object({
  ui: z.literal("dream_result_fast"),
  summary: z.string(),
  hint: z.string().optional(),
});

const dreamResultPrecise = z.object({
  ui: z.literal("dream_result_precise"),
  empathy: z.string(),
  threeViews: z.object({
    zhouGong: z.string(),
    freud: z.string(),
    jung: z.string(),
  }),
  coreMeaning: z.string(),
  suggestions: z.array(z.string()),
  subconsciousMsg: z.string(),
  conclusion: z.string(),
  summary: z.string(),
});

const baziResult = z.object({
  ui: z.literal("bazi_result"),
  profileId: z.string().uuid(),
  focus: z.string(),
  chart: z.unknown(),
  aiText: z.string(),
});

const meihuaResult = z.object({
  ui: z.literal("meihua_result"),
  profileId: z.string().uuid(),
  benGua: z.string(),
  huGua: z.string(),
  bianGua: z.string(),
  guaZhongGua: z.string().optional(),
  dongYao: z.number().int().min(1).max(6),
  tiYong: z.string(),
  yingQi: z.string(),
  verdict: z.string(),
  aiText: z.string(),
});

const fortuneBriefCard = z.object({
  ui: z.literal("fortune_brief_card"),
  date: z.string(),
  overall: z.number().min(0).max(100),
  topDimension: z.string(),
  oneLiner: z.string(),
});

// ============ auxiliary ============

const summaryCard = z.object({
  ui: z.literal("summary_card"),
  summary: z.string(),
  messagesCount: z.number().int().positive(),
});

const profileAddedHint = z.object({
  ui: z.literal("profile_added_hint"),
  profileId: z.string().uuid(),
  nickname: z.string(),
});

const quickActionChips = z.object({
  ui: z.literal("quick_action_chips"),
  chips: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      intent: z.enum(["divination", "dream", "bazi", "meihua", "chat"]).optional(),
    }),
  ),
});

// ============ union ============

export const CardMetaSchema = z.discriminatedUnion("ui", [
  intentPending,
  progressLongTask,
  errorCard,
  choiceCard,
  profilePicker,
  slipTypePicker,
  baziFocusPicker,
  slipQuestionInput,
  baziQuickForm,
  meihuaNumberInput,
  dreamFastInput,
  dreamPreciseForm,
  slipDrawing,
  slipImage,
  slipReport,
  dreamResultFast,
  dreamResultPrecise,
  baziResult,
  meihuaResult,
  fortuneBriefCard,
  summaryCard,
  profileAddedHint,
  quickActionChips,
]);

export type CardMeta = z.infer<typeof CardMetaSchema>;

export type CardUiType = CardMeta["ui"];

/** 全部 23 ui 字面量列表（运行时枚举 / 测试） */
export const ALL_CARD_UI_TYPES = [
  "intent_pending",
  "progress_long_task",
  "error_card",
  "choice_card",
  "profile_picker",
  "slip_type_picker",
  "bazi_focus_picker",
  "slip_question_input",
  "bazi_quick_form",
  "meihua_number_input",
  "dream_fast_input",
  "dream_precise_form",
  "slip_drawing",
  "slip_image",
  "slip_report",
  "dream_result_fast",
  "dream_result_precise",
  "bazi_result",
  "meihua_result",
  "fortune_brief_card",
  "summary_card",
  "profile_added_hint",
  "quick_action_chips",
] as const satisfies ReadonlyArray<CardUiType>;

export function isCardMeta(v: unknown): v is CardMeta {
  return CardMetaSchema.safeParse(v).success;
}

export function parseCardMeta(s: string): CardMeta | null {
  try {
    const parsed: unknown = JSON.parse(s);
    const result = CardMetaSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** stringify 用于写入 messages.metadata 列。先 validate 再 stringify。 */
export function stringifyCardMeta(meta: CardMeta): string {
  CardMetaSchema.parse(meta);
  return JSON.stringify(meta);
}
