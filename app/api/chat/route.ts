import { z } from "zod";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { classifyIntent } from "@/lib/ai/intent";
import { isWithinLimit, type CountUserMessagesDeps } from "@/lib/ai/rate-limit";
import { chat } from "@/lib/ai/client";
import type { Intent } from "@/types/domain";

/**
 * POST /api/chat — SSE 流式对话端点
 *
 * 请求 body：
 *   { conversationId?: uuid, text: string (1-2000), intentHint?: Intent }
 *
 * SSE 事件：
 *   event: meta   data: { conversationId, intent }
 *   event: token  data: "<chunk text>"
 *   event: done   data: { tokens }
 *   event: error  data: { message }
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().optional(),
  text: z.string().min(1, "消息不能为空").max(2000, "消息超过 2000 字"),
  intentHint: z.enum(["chat", "divination", "dream", "bazi", "meihua"]).optional(),
});

const FALLBACK_SYSTEM_PROMPT = [
  "你是轻运 AI，一位温柔、年轻化的国学陪伴助手。",
  "回复风格：自然、简短（默认 80–200 字），有温度但不端说教架子。",
  "禁用：大凶 / 倒霉 / 厄运 / 命中注定 等绝对负面词。把不利信号转成『适合静一静』、『可以慢一点』这类柔和说法。",
  "结尾不要硬贴『加油』、『相信自己』这种空洞鸡汤。",
].join("\n");

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("校验失败", 400);
  }
  const { conversationId: incomingConvId, text, intentHint } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  // 限流：按 user 维度统计 messages.role='user' 一小时内条数
  const deps: CountUserMessagesDeps = {
    countUserMessages: async (uid, sinceIso) => {
      const r = await db
        .select({ n: count() })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversation_id))
        .where(
          and(
            eq(conversations.user_id, uid),
            eq(messages.role, "user"),
            gte(messages.created_at, sinceIso),
          ),
        );
      return r[0]?.n ?? 0;
    },
  };
  const limit = await isWithinLimit(userId, deps);
  if (!limit.allowed) {
    return jsonError(
      `每小时上限 ${limit.limit} 条，请稍后再试（已发 ${limit.used}）`,
      429,
    );
  }

  const intent: Intent = classifyIntent(text, { hint: intentHint });

  // 建/取 conversation
  let convId = incomingConvId ?? null;
  if (convId) {
    // 校验会话归属
    const owned = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.user_id, userId)))
      .limit(1);
    if (!owned[0]) {
      return jsonError("会话不存在", 404);
    }
  } else {
    const [created] = await db
      .insert(conversations)
      .values({
        user_id: userId,
        profile_id: null,
        title: text.slice(0, 10),
      })
      .returning({ id: conversations.id });
    convId = created?.id ?? null;
    if (!convId) return jsonError("创建会话失败", 500);
  }
  const finalConvId: string = convId;

  // 落 user message
  await db.insert(messages).values({
    conversation_id: finalConvId,
    role: "user",
    content: text,
    intent,
  });

  // 调 AI Gateway 流式
  const stream = await chat({
    messages: [{ role: "user", content: text }],
    systemPrompt: FALLBACK_SYSTEM_PROMPT,
    stream: true,
    meta: { conversationId: finalConvId, userId },
  });

  const encoder = new TextEncoder();
  let assistantText = "";
  let totalTokens = 0;

  const sse = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        sseFrame(encoder, "meta", { conversationId: finalConvId, intent }),
      );
      try {
        for await (const chunk of stream.textStream) {
          assistantText += chunk;
          controller.enqueue(sseFrame(encoder, "token", chunk));
        }
        try {
          const usage = await stream.usage;
          totalTokens = usage.totalTokens ?? 0;
        } catch {
          /* usage 拉不到不致命 */
        }
        controller.enqueue(sseFrame(encoder, "done", { tokens: totalTokens }));
      } catch (e) {
        console.error("AI 流式中断", e);
        controller.enqueue(
          sseFrame(encoder, "error", {
            message: "AI 卡了一下，已记录请稍后再试",
          }),
        );
      } finally {
        controller.close();

        // 落 assistant message + 更新 last_message_at（非阻塞）
        try {
          await db.insert(messages).values({
            conversation_id: finalConvId,
            role: "assistant",
            content: assistantText || "(无内容)",
            intent,
            tokens_used: totalTokens,
          });
          await db
            .update(conversations)
            .set({ last_message_at: new Date().toISOString() })
            .where(eq(conversations.id, finalConvId));
        } catch (e) {
          console.error("assistant 落库失败", e);
        }
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sseFrame(encoder: TextEncoder, event: string, data: unknown): Uint8Array {
  // client 一律 JSON.parse(data)：string chunk → '"xxx"'，object → JSON.stringify({...}) 一次
  const payload = JSON.stringify(data);
  return encoder.encode(`event: ${event}\ndata: ${payload}\n\n`);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
