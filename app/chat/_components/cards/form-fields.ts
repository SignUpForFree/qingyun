/**
 * FormCard 字段配置 — 与 ChatWindow handleCardSubmit 提交字段名严格对齐
 *
 * 改字段名时，同时检查：
 * - lib/chat/router.ts（卡的 metadata 生成处）
 * - app/chat/_components/use-card-handlers.ts（提交时读 values[key]）
 * - app/api/divination/{qianwen,bazi,meihua,dream}/route.ts（zod schema）
 */

import type { FormField } from "./FormCard";

/**
 * 解梦"精准"模式 4 字段
 *
 * 文案对齐 测试bug.xlsx R4：
 *   1、描述梦境中的画面和人/物/地点以及发生的故事
 *   2、在梦境里你是什么情绪感受，醒来后情绪有没有变化？
 *   3、最近的现实生活中，有没有类似的场景、情绪，或者让你在意的事情？
 *   4、该梦境是否有比较特别的，让你觉得奇怪或是印象深刻的？
 */
export const DREAM_PRECISE_FIELDS: readonly FormField[] = [
  {
    key: "core",
    label: "1、描述梦境中的画面和人 / 物 / 地点以及发生的故事",
    type: "textarea",
    required: true,
    max: 500,
    placeholder: "例如：在一条没尽头的小路上找一只白猫，路边的树是金色的…",
  },
  {
    key: "emotion",
    label: "2、在梦境里你是什么情绪感受？醒来后情绪有没有变化？",
    type: "textarea",
    required: true,
    max: 200,
    placeholder: "例如：梦里很慌，醒来后心里还有点闷",
  },
  {
    key: "reality",
    label: "3、最近的现实生活中，有没有类似的场景、情绪，或者让你在意的事情？（可选）",
    type: "textarea",
    max: 200,
    placeholder: "例如：最近换了工作，担心融不进去",
  },
  {
    key: "special",
    label: "4、该梦境是否有比较特别的，让你觉得奇怪或是印象深刻的？（可选）",
    type: "textarea",
    max: 200,
    placeholder: "例如：梦里反复出现一只眼睛、或者颜色异常鲜艳的物体",
  },
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
  {
    key: "userQuestion",
    label: "",
    type: "textarea",
    required: true,
    max: 200,
    placeholder: "请描述你遇到的事情和想问的问题",
  },
];
