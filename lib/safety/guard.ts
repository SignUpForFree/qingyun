import { NextResponse } from "next/server";
import { classifySafety, type SafetyResult } from "./sensitive";

/**
 * Route 入口共享 guard：检测一组用户文本，命中 hard 立即返回 400
 *
 * 用法：
 *   const fail = guardTexts({ a: text, b: question });
 *   if (fail) return fail;
 *
 * soft 命中暂不打断流程（spec §6.5 简化版），调用方需要可在响应里附加 SafetyResult
 */
export function guardTexts(
  texts: Record<string, string | null | undefined>,
): NextResponse | null {
  for (const [, text] of Object.entries(texts)) {
    if (!text) continue;
    const r = classifySafety(text);
    if (r.level === "hard") {
      return NextResponse.json(
        { error: r.message, safetyLevel: r.level, matched: r.matched },
        { status: 400 },
      );
    }
  }
  return null;
}

/**
 * 查 soft 命中（不拒绝，只回带 SafetyResult 给路由决定后续处理）
 */
export function softCheck(
  texts: Record<string, string | null | undefined>,
): SafetyResult | null {
  for (const [, text] of Object.entries(texts)) {
    if (!text) continue;
    const r = classifySafety(text);
    if (r.level === "soft") return r;
  }
  return null;
}
