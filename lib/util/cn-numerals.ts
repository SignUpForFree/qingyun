/**
 * 中文数字工具（spec design §7 SlipResultCard）
 *
 * - numberToChinese(86) → "八十六"
 * - chineseSignature(86) → "八 · 十 · 六"（仪式感间隔点）
 *
 * 仅覆盖 1-100（灵签编号范围），其他抛错。
 */

const DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;

export function numberToChinese(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error(`numberToChinese 仅支持 1-100，传入 ${n}`);
  }
  if (n === 100) return "一百";
  if (n < 10) return DIGITS[n]!;
  if (n < 20) return n === 10 ? "十" : `十${DIGITS[n - 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? `${DIGITS[tens]}十` : `${DIGITS[tens]}十${DIGITS[ones]}`;
}

/**
 * 把签号渲染为带 · 间隔的中文字符串。
 *
 * - 86 → "八 · 十 · 六"
 * - 8  → "八"
 * - 100 → "一 · 百"
 *
 * 用于"第 八 · 十 · 六 签"这种仪式感标题。
 */
export function chineseSignature(n: number): string {
  return numberToChinese(n).split("").join(" · ");
}
