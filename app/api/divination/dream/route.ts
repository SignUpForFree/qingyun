import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  conversations,
  divinationRecords,
  messages,
} from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { serializeJson } from "@/lib/db/json";
import {
  buildEmotionHint,
  dreamInputSchema,
} from "@/lib/divination/dream-parser";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { chat } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";

/**
 * POST /api/divination/dream — 解梦 + 落库
 *
 * 流程：
 *   1. 校验 body { dreamText, emotion?, conversationId? }
 *   2. ensureUserId + 校验 / 自动创建 conversation
 *   3. 落 user message（梦境原文）
 *   4. loadPrompt('dream.parse') + renderTemplate → chat() 生成 4 段解读
 *   5. 落 assistant message（intent='dream'，metadata={ ui:'dream_result', emotion }）
 *   6. 写 divination_records (type='dream')
 *   7. 返回 { conversationId, userMessage, assistantMessage }
 *
 * 走非流式（一次性返回）：解梦输出长但用户体验上一次性给出比逐字流更稳；
 * P2 后端有空再升级为 SSE。
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const bodyShape = raw as { conversationId?: unknown };
  const incomingConvId =
    typeof bodyShape?.conversationId === "string" && bodyShape.conversationId.length > 0
      ? bodyShape.conversationId
      : undefined;

  const parsed = dreamInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { dreamText, emotion } = parsed.data;

  const userId = await ensureUserId();

  const rate = await checkRateLimit(userId);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `每小时上限 ${rate.limit} 条，请稍后再试（已用 ${rate.used}）` },
      { status: 429 },
    );
  }

  const db = getDb();

  let conversationId: string;
  if (incomingConvId) {
    const owned = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, incomingConvId), eq(conversations.user_id, userId)))
      .limit(1);
    if (!owned[0]) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    conversationId = incomingConvId;
  } else {
    const [created] = await db
      .insert(conversations)
      .values({
        user_id: userId,
        title: emotion ? `解梦 · ${emotion}` : "解梦",
      })
      .returning({ id: conversations.id });
    if (!created) {
      return NextResponse.json({ error: "会话创建失败" }, { status: 500 });
    }
    conversationId = created.id;
  }

  // 落用户原话
  const [userMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "user",
      content: emotion ? `[解梦 · ${emotion}] ${dreamText}` : `[解梦] ${dreamText}`,
      intent: "dream",
    })
    .returning();
  if (!userMsg) {
    return NextResponse.json({ error: "用户消息写入失败" }, { status: 500 });
  }

  // AI 解读
  let prompt;
  try {
    prompt = await loadPrompt("dream.parse");
  } catch (e) {
    return NextResponse.json(
      { error: `dream.parse prompt 未种入: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const userText = renderTemplate(prompt.userPromptTpl, {
    dreamText,
    emotionHint: buildEmotionHint(emotion),
  });

  const ai = await chat({
    systemPrompt: prompt.systemPrompt,
    messages: [{ role: "user", content: userText }],
    stream: false,
    meta: { conversationId, userId },
  });

  // 落 assistant
  const [insertedMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: ai.text,
      intent: "dream",
      tokens_used: ai.tokensUsed,
      metadata: serializeJson({ ui: "dream_result", emotion: emotion ?? null }),
    })
    .returning();
  if (!insertedMsg) {
    return NextResponse.json({ error: "解读消息写入失败" }, { status: 500 });
  }

  await db.insert(divinationRecords).values({
    message_id: insertedMsg.id,
    type: "dream",
    input: serializeJson({ dreamText, emotion: emotion ?? null }),
    result: serializeJson({ reading: ai.text, tokensUsed: ai.tokensUsed }),
    ai_reading: ai.text,
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
    assistantMessage: {
      id: insertedMsg.id,
      role: "assistant" as const,
      content: insertedMsg.content,
      created_at: insertedMsg.created_at,
      metadata: insertedMsg.metadata,
    },
  });
}
