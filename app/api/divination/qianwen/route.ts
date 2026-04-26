import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  conversations,
  divinationRecords,
  divinationSlips,
  messages,
} from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { pickSlip } from "@/lib/divination/slips";
import { parseJson, serializeJson } from "@/lib/db/json";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { chat } from "@/lib/ai/client";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";

/**
 * POST /api/divination/qianwen — 抽签 sub-action
 *
 * 调用前提：客户端已通过 /api/chat 拿到 slip_type_picker 卡，
 * 用户在卡上选了 dimension + 输入了 userQuestion，连同 conversationId 提交本接口。
 *
 * 请求 body：{ conversationId, dimension(新 6 类), userQuestion }
 *
 * 工作流（同步返回 3 条 message ID）：
 *   1. 抽签 → divination_slips by number
 *   2. user message：[抽签 · {dimension}] {userQuestion}
 *   3. assistant message：metadata.ui = 'slip_image' + slip 元信息
 *   4. 调 AI 解读（非流式） → 第三条 assistant message metadata.ui='text'
 *   5. 写 divination_records + 更新 last_message_at
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const DIMENSIONS = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

const bodySchema = z.object({
  conversationId: z.string().min(1),
  dimension: z.enum(DIMENSIONS),
  userQuestion: z.string().min(1).max(500),
});

type SlipReadings = Partial<Record<(typeof DIMENSIONS)[number], string>>;

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
  const { conversationId, dimension, userQuestion } = parsed.data;

  const safetyFail = guardTexts({ userQuestion });
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

  const { number } = pickSlip({ seed: `${userId}-${Date.now()}` });
  const slipRow = await db
    .select()
    .from(divinationSlips)
    .where(eq(divinationSlips.number, number))
    .limit(1);
  const slip = slipRow[0];
  if (!slip) return jsonError(`灵签 #${number} 未找到`, 500);

  const readings = parseJson<SlipReadings>(slip.readings, {});
  const reading =
    readings[dimension] ?? readings["综合运势"] ?? "（暂无该维度解读）";

  const [userMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "user",
      content: `[抽签 · ${dimension}] ${userQuestion}`,
      intent: "divination",
    })
    .returning();

  const [cardMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: `抽到第 ${slip.number} 签 · ${slip.level} · ${slip.title}`,
      intent: "divination",
      metadata: serializeJson({
        ui: "slip_image",
        slipNumber: slip.number,
        level: slip.level,
        title: slip.title,
        poem: slip.poem,
        dimension,
        reading,
      }),
    })
    .returning();

  if (!userMsg || !cardMsg) return jsonError("消息写入失败", 500);

  await db.insert(divinationRecords).values({
    message_id: cardMsg.id,
    type: "qianwen",
    input: serializeJson({ dimension, userQuestion }),
    result: serializeJson({
      number: slip.number,
      level: slip.level,
      title: slip.title,
      poem: slip.poem,
      reading,
    }),
  });

  let aiReading: {
    id: string;
    role: "assistant";
    content: string;
    created_at: string;
    metadata: string | null;
  } | null = null;
  try {
    const prompt = await loadPrompt("divination.qianwen");
    const userText = renderTemplate(prompt.userPromptTpl, {
      number: slip.number,
      level: slip.level,
      title: slip.title,
      poem: slip.poem,
      dimension,
      userQuestion,
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: userText }],
      stream: false,
      meta: { conversationId, userId },
    });
    const [aiMsg] = await db
      .insert(messages)
      .values({
        conversation_id: conversationId,
        role: "assistant",
        content: ai.text,
        intent: "divination",
        tokens_used: ai.tokensUsed,
        metadata: serializeJson({ ui: "text", source: "slip_reading" }),
      })
      .returning();
    if (aiMsg) {
      aiReading = {
        id: aiMsg.id,
        role: "assistant",
        content: aiMsg.content,
        created_at: aiMsg.created_at,
        metadata: aiMsg.metadata,
      };
    }
  } catch (e) {
    console.error("抽签 AI 解读失败（卡片仍返回）", e);
  }

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
    cardMessage: {
      id: cardMsg.id,
      role: "assistant" as const,
      content: cardMsg.content,
      created_at: cardMsg.created_at,
      metadata: cardMsg.metadata,
    },
    aiReadingMessage: aiReading,
  });
}

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
