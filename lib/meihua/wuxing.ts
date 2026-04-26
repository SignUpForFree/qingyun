import { KE_CYCLE, SHENG_CYCLE, type Wuxing } from "@/lib/bazi/stems-branches";

/**
 * 两个五行的关系（从 a 视角看）
 *
 *   sheng = a 生 b（a 输出能量给 b，a 略泄气）
 *   ke    = a 克 b（a 主导制约 b）
 *   sheng_by = a 被 b 生（a 受益于 b）
 *   ke_by    = a 被 b 克（a 被 b 制约）
 *   he       = 比和（a == b）
 */
export type WuxingRelation = "sheng" | "ke" | "sheng_by" | "ke_by" | "he";

export function relate(a: Wuxing, b: Wuxing): WuxingRelation {
  if (a === b) return "he";
  if (SHENG_CYCLE[a] === b) return "sheng";
  if (KE_CYCLE[a] === b) return "ke";
  if (SHENG_CYCLE[b] === a) return "sheng_by";
  if (KE_CYCLE[b] === a) return "ke_by";
  // 不可能到这里：5 元素之间必属上述 5 种关系之一
  throw new Error(`不可能的五行关系: ${a} - ${b}`);
}
