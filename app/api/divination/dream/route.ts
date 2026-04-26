import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, divinationRecords, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { serializeJson } from "@/lib/db/json";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";

/**
 * POST /api/divination/dream — 解梦 sub-action
 *
 * 接 dream_choice 卡的提交：
 *   - fast：用户在快速 form 输入 dreamText（+ 可选 emotion）
 *   - precise：用户在精准 form 输入 4 字段（core / emotion / reality / special）
 *
 * 工作流：写 user message → 调 AI → 写 assistant message(metadata.ui='dream_result')
 *        → 写 divination_records (type='dream') → 更新 last_message_at
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const fastSchema = z.object({
  dreamText: z.string().min(10).max(2000),
  emotion: z.enum(["平静", "害怕", "焦虑", "喜悦", "疑惑"]).nullish(),
});

const preciseSchema = z.object({
  core: z.string().min(5).max(500),
  emotion: z.string().min(2).max(200),
  reality: z.string().max(200).nullish(),
  special: z.string().max(200).nullish(),
});

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    conversationId: z.string().min(1),
    mode: z.literal("fast"),
    payload: fastSchema,
  }),
  z.object({
    conversationId: z.string().min(1),
    mode: z.literal("precise"),
    payload: preciseSchema,
  }),
]);

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { conversationId, mode, payload } = parsed.data;

  const safetyText =
    mode === "fast"
      ? payload.dreamText
      : `${payload.core}\n${payload.emotion}\n${payload.reality ?? ""}\n${payload.special ?? ""}`;
  const safetyFail = guardTexts({ dream: safetyText });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const rate = await checkRateLimit(userId);
  if (!rate.allowed) {
    return jsonError(
      `每小时上限 ${rate.limit} 条，请稍后再试（已用 ${rate.used}）`,
      429,
    );
  }

  const db = getDb();
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)),
    )
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);

  const userText =
    mode === "fast"
      ? `[解梦 · 快速${payload.emotion ? " · " + payload.emotion : ""}] ${payload.dreamText}`
      : [
          "[解梦 · 精准]",
          `核心场景：${payload.core}`,
          `情绪感受：${payload.emotion}`,
          payload.reality ? `现实关联：${payload.reality}` : null,
          payload.special ? `特殊细节：${payload.special}` : null,
        ]
          .filter(Boolean)
          .join("\n");

  const [userMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "user",
      content: userText,
      intent: "dream",
    })
    .returning();
  if (!userMsg) return jsonError("用户消息写入失败", 500);

  let aiText = "（解读暂时不可用，请稍后再试）";
  let tokens = 0;
  try {
    const prompt = await loadPrompt("dream.parse");
    const dreamFullText =
      mode === "fast"
        ? payload.dreamText
        : [
            `核心场景：${payload.core}`,
            payload.reality ? `现实关联：${payload.reality}` : null,
            payload.special ? `特殊细节：${payload.special}` : null,
          ]
            .filter(Boolean)
            .join("\n");
    const tpl = renderTemplate(prompt.userPromptTpl, {
      dreamText: dreamFullText,
      emotionHint: `情绪：${mode === "fast" ? (payload.emotion ?? "未明确") : payload.emotion}`,
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: tpl }],
      stream: false,
      meta: { conversationId, userId },
    });
    aiText = ai.text;
    tokens = ai.tokensUsed;
  } catch (e) {
    console.error("dream AI 解读失败", e);
  }

  const [resultMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: aiText,
      intent: "dream",
      tokens_used: tokens,
      metadata: serializeJson({ ui: "dream_result", mode }),
    })
    .returning();
  if (!resultMsg) return jsonError("解读消息写入失败", 500);

  await db.insert(divinationRecords).values({
    message_id: resultMsg.id,
    type: "dream",
    input: serializeJson({ mode, payload }),
    result: serializeJson({ text: aiText }),
    ai_reading: aiText,
  });

  await db
    .update(conversations)
    .set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({
    conversationId,
    userMessage: {
      id: userMsg.id,
      role: "user" as const,
      content: userMsg.content,
      created_at: userMsg.created_at,
    },
    resultMessage: {
      id: resultMsg.id,
      role: "assistant" as const,
      content: resultMsg.content,
      created_at: resultMsg.created_at,
      metadata: resultMsg.metadata,
    },
  });
}

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
