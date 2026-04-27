import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyIntent } from "@/lib/ai/intent-classifier";

export const runtime = "nodejs";

/**
 * /api/intent/classify — 前端预判端点（M2.27, spec §4.2）
 *
 * - 仅返回意图分类，不写 messages / 不计费 / 不调摘要器
 * - 用途：ChatInput 在用户输入时 debounce 调用，预测意图
 *   让前端提前展示 "你是想 X 吗？" 的引导卡，减少回合数
 * - 直接复用 lib/ai/intent-classifier.ts 的 keyword + LLM 兜底
 *   B 策略，与正式 /api/chat 路由器同源避免分类漂移
 */

const RequestSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await classifyIntent(parsed.data.text);
  return NextResponse.json({
    intent: result.intent,
    confidence: result.confidence,
    source: result.source,
  });
}
