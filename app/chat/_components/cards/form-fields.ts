/**
 * FormCard 字段配置 — 与 ChatWindow handleCardSubmit 提交字段名严格对齐
 *
 * 改字段名时，同时检查：
 * - lib/chat/router.ts（卡的 metadata 生成处）
 * - app/chat/_components/use-card-handlers.ts（提交时读 values[key]）
 * - app/api/divination/{qianwen,bazi,meihua,dream}/route.ts（zod schema）
 */

import type { FormField } from "./FormCard";

export const DREAM_PRECISE_FIELDS: readonly FormField[] = [
  { key: "core", label: "核心场景", type: "textarea", required: true, max: 500 },
  { key: "emotion", label: "情绪感受", type: "textarea", required: true, max: 200 },
  { key: "reality", label: "现实关联（可选）", type: "textarea", max: 200 },
  { key: "special", label: "特殊细节（可选）", type: "textarea", max: 200 },
];

export const BAZI_QUICK_FIELDS: readonly FormField[] = [
  {
    key: "gender",
    label: "性别",
    type: "select",
    required: true,
    options: [
      { value: "male", label: "男" },
      { value: "female", label: "女" },
    ],
  },
  { key: "birth_time", label: "出生时间（含时辰）", type: "text", required: true, max: 30 },
  { key: "birth_place", label: "出生地（省 市 区）", type: "text", required: true, max: 30 },
];

export const MEIHUA_NUMBER_FIELDS: readonly FormField[] = [
  { key: "numbers", label: "1-3 个数字（1-9，逗号分隔）", type: "text", required: true, max: 20 },
  { key: "userQuestion", label: "想测什么事？", type: "textarea", required: true, max: 200 },
];

export const SLIP_QUESTION_FIELDS: readonly FormField[] = [
  { key: "userQuestion", label: "心事 / 想问的事", type: "textarea", required: true, max: 200 },
];
