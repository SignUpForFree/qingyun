import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { classifyIntent } from "@/lib/ai/intent-classifier";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { shouldSummarize, summarize } from "@/lib/ai/summarizer";
import { routeIntent } from "@/lib/chat/router";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import type { Intent } from "@/types/domain";

/**
 * POST /api/chat — SSE 6 事件流式对话端点 (M2.15)
 *
 * Body：{ conversationId?: string|null, text: string (1-2000) }
 * Query：?intent=divination|dream|bazi|meihua|chat 强制覆盖分类器（用于按钮回流）
 *
 * 工作流：
 *   1. 校验 (zod nullish #1) + 限流 + 安全词
 *   2. ensure user / conversation（首次会话用 text 前 10 字做 title）
 *   3. classifyIntent (?intent= 覆盖 → keyword → LLM)
 *   4. 写 user message + 更新 conversation.last_intent / last_message_at
 *   5. routeIntent 分流：chat 流式 / 4 类引导卡
 *   6. 25s heartbeat 防 nginx/wechat 代理切连 (#18)
 *   7. enqueue 走 safeEnqueue (#11)
 *   8. finally void maybeSummarize
 *
 * SSE 6 events：meta / token / card / progress / done / error
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_MS = 25_000;

const bodySchema = z.object({
  conversationId: z.string().min(1).nullish(),
  text: z.string().min(1, "消息不能为空").max(2000, "消息超过 2000 字"),
});

const VALID_INTENT_QUERY = ["divination", "dream", "bazi", "meihua", "chat"] as const;

function parseIntentQuery(req: Request): Intent | null {
  const url = new URL(req.url);
  const v = url.searchParams.get("intent");
  if (!v) return null;
  return (VALID_INTENT_QUERY as readonly string[]).includes(v) ? (v as Intent) : null;
}

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
  const { conversationId: incomingConvId, text } = parsed.data;

  const safetyFail = guardTexts({ text });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();

  // B1 修：先分类再限额，按实际 intent 限额（之前写死 "chat" 让 bazi/meihua/dream/
  // divination 都吃 chat 30/h 而不是各自 8/12/8/8 → 重消耗类型刷不住）
  const overrideIntent = parseIntentQuery(req);
  const cls = overrideIntent
    ? { intent: overrideIntent, confidence: 1, source: "query" as const }
    : await classifyIntent(text);
  const intent: Intent = cls.intent;

  const limit = await checkRateLimit(userId, intent);
  if (!limit.allowed) {
    const intentLabel: Record<string, string> = {
      chat: "聊天",
      divination: "抽签",
      bazi: "八字",
      meihua: "梅花",
      dream: "解梦",
    };
    return jsonError(
      `每小时${intentLabel[intent] ?? intent}上限 ${limit.limit} 次，请稍后再试（已发 ${limit.used}）`,
      429,
    );
  }

  const db = getDb();

  let convId = incomingConvId ?? null;
  if (convId) {
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

  await db.insert(messages).values({
    conversation_id: finalConvId,
    role: "user",
    content: text,
    intent,
  });

  await db
    .update(conversations)
    .set({ last_intent: intent, last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, finalConvId));

  // 客户端断流（用户关页 / SSE 主动 cancel）→ abort 透传到上游 DeepSeek
  // 防御 §3.2-J：之前 cancel() 是空的，stream 还在烧 token 直到自然结束（最坏 60s）。
  const ac = new AbortController();

  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      let heartbeatId: ReturnType<typeof setInterval> | null = setInterval(() => {
        safeEnqueue(controller, heartbeat());
      }, HEARTBEAT_MS);

      const stopHeartbeat = () => {
        if (heartbeatId) {
          clearInterval(heartbeatId);
          heartbeatId = null;
        }
      };

      safeEnqueue(
        controller,
        frame("meta", {
          conversationId: finalConvId,
          intent,
          source: cls.source,
        }),
      );

      try {
        await routeIntent({
          controller,
          conversationId: finalConvId,
          userId,
          text,
          intent,
          abortSignal: ac.signal,
        });
        safeEnqueue(controller, frame("done", {}));
      } catch (e) {
        // 用户主动断流不算错，吞掉静默
        if ((e as Error)?.name !== "AbortError") {
          if (process.env.NODE_ENV !== "production") {
            console.error("/api/chat 失败", e);
          }
          safeEnqueue(
            controller,
            frame("error", {
              message: "AI 卡了一下，请稍后再试",
              retryable: true,
            }),
          );
        }
      } finally {
        stopHeartbeat();
        try {
          controller.close();
        } catch {
          /* 已 close 不致命 */
        }
        void maybeSummarize(finalConvId);
      }
    },
    cancel() {
      // 客户端断开 → 触发 abort，让 chat() 内部 fetch 立刻取消，
      // 已在 start() 的 finally 由 stopHeartbeat / controller.close 收尾。
      ac.abort(new DOMException("Client disconnected", "AbortError"));
    },
  });

  return new Response(sse, { headers: SSE_HEADERS });
}

async function maybeSummarize(convId: string) {
  try {
    const db = getDb();
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, convId))
      .limit(1);
    if (!conv) return;
    const allMsgs = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversation_id, convId));
    if (shouldSummarize(allMsgs.length, conv.summary_msg_count ?? 0)) {
      await summarize(convId);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("maybeSummarize failed", e);
    }
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
