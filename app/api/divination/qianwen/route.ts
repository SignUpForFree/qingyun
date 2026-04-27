import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages, slips } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { pickSlip } from "@/lib/divination/slips";
import { serializeJson } from "@/lib/db/json";

export const runtime = "nodejs";

/**
 * /api/divination/qianwen — 抽签 step1 & step2 (M2.16, spec §4.4)
 *
 * 两阶段流程（同一端点，body 字段决定走哪步）：
 *
 * Step 1: { conversationId, category } → 写 slip_question_input 卡，引导用户输入问题
 * Step 2: { conversationId, category, userQuestion } → drawSlip → 写 slip_image 卡
 *
 * AI 解读独立到 /api/divination/qianwen/explain（M2.17）异步流式生成 slip_report 卡。
 *
 * 限流：DIVINATION 维度（与 /api/chat 共享 user 限流计数）。
 */

const VALID_CATEGORIES = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

const bodySchema = z.object({
  conversationId: z.string().min(1).nullish(),
  category: z.enum(VALID_CATEGORIES),
  userQuestion: z.string().trim().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "校验失败", 400);
  }
  const { conversationId, category, userQuestion } = parsed.data;

  const safetyFail = guardTexts({
    text: userQuestion ?? "",
  });
  if (userQuestion && safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const limit = await checkRateLimit(userId);
  if (!limit.allowed) {
    return jsonError(
      `每小时上限 ${limit.limit} 条，请稍后再试（已发 ${limit.used}）`,
      429,
    );
  }

  const db = getDb();

  if (!conversationId) {
    return jsonError("conversationId 必填", 400);
  }
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) {
    return jsonError("会话不存在", 404);
  }

  // ============ Step 1：仅 category，写 slip_question_input 卡 ============

  if (!userQuestion) {
    const cardMeta = {
      ui: "slip_question_input" as const,
      category,
      placeholder: `默念${category}相关的具体问题，写下来更准`,
    };
    const [card] = await db
      .insert(messages)
      .values({
        conversation_id: conversationId,
        role: "assistant",
        content: `请默念${category}的具体问题`,
        intent: "divination",
        metadata: serializeJson(cardMeta),
      })
      .returning();

    return Response.json({
      step: "question_input",
      card: {
        id: card?.id,
        role: "assistant",
        content: `请默念${category}的具体问题`,
        metadata: serializeJson(cardMeta),
      },
    });
  }

  // ============ Step 2：完整 input，抽签 + 写 slip_image 卡 ============

  // 写 user message（用户提交的问题）
  await db.insert(messages).values({
    conversation_id: conversationId,
    role: "user",
    content: userQuestion,
    intent: "divination",
  });

  // seed = userId + date + category + question 让同一用户当天同问题同结果（仪式感）
  const today = new Date().toISOString().slice(0, 10);
  const seed = `${userId}:${today}:${category}:${userQuestion}`;
  const pick = pickSlip({ seed, max: 100 });

  // 查 slip 详情（slips 表 M3 才 seed 100 签；空表场景兜底）
  const [slip] = await db.select().from(slips).where(eq(slips.number, pick.number)).limit(1);

  if (!slip) {
    // M3 seed 之前 slip 表为空；直接返 placeholder 卡，不阻塞流程
    return jsonError(
      `第 ${pick.number} 签数据未就绪（M3 seed 后可用）`,
      503,
    );
  }

  // 解析 category_readings JSON 拿到对应维度的 reading
  let reading = slip.default_reading;
  try {
    const readings = JSON.parse(slip.category_readings) as Record<string, string>;
    reading = readings[category] ?? slip.default_reading;
  } catch {
    /* JSON 坏的话 fallback default_reading */
  }

  // 拆 poem 4 句（slip.poem 用 \n 或 ， 分隔）
  const poemLines = slip.poem
    .split(/[\n，。！？]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);

  const cardMeta = {
    ui: "slip_image" as const,
    slipNumber: slip.number,
    level: slip.level,
    title: slip.title,
    poemLines,
    imageUrl: `/api/divination/slip-image/${slip.number}`,
    category,
    reading,
  };

  const [card] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: `第 ${slip.number} 签 · ${slip.title}`,
      intent: "divination",
      metadata: serializeJson(cardMeta),
    })
    .returning();

  await db
    .update(conversations)
    .set({ last_intent: "divination", last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return Response.json({
    step: "slip_drawn",
    card: {
      id: card?.id,
      role: "assistant",
      content: `第 ${slip.number} 签 · ${slip.title}`,
      metadata: serializeJson(cardMeta),
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
