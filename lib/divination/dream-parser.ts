import { z } from "zod";

/**
 * 梦境输入校验 + 归一化（spec §5 解梦）
 *
 * - dreamText: 10–2000 字符（短了像没说，长了 token 浪费）
 * - emotion 可选，5 选 1：作为 prompt 的 emotionHint 提示
 *
 * 校验失败抛 ZodError，由路由处理转 400
 */
export const DREAM_EMOTIONS = [
  "平静",
  "害怕",
  "困惑",
  "愉悦",
  "难过",
] as const;

export type DreamEmotion = (typeof DREAM_EMOTIONS)[number];

export const dreamInputSchema = z.object({
  dreamText: z
    .string()
    .trim()
    .min(10, "梦境描述太短，至少 10 个字让我能看清画面")
    .max(2000, "梦境太长（>2000 字），可以挑核心场景再讲一次"),
  emotion: z.enum(DREAM_EMOTIONS).optional(),
});

export type DreamInput = z.infer<typeof dreamInputSchema>;

export function buildEmotionHint(emotion: DreamEmotion | undefined): string {
  if (!emotion) return "醒来时的情绪：未明确，由你从梦境推断。";
  return `醒来时的主导情绪：${emotion}，请在解读里贴合这种感受。`;
}
