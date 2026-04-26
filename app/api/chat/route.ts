import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { classifyIntent } from "@/lib/ai/intent-classifier";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { chat } from "@/lib/ai/client";
import { guardTexts } from "@/lib/safety/guard";
import {
  buildPromptMessages,
  shouldSummarize,
  summarize,
  K_RECENT,
} from "@/lib/ai/summarizer";
import { serializeJson } from "@/lib/db/json";
import type { Intent } from "@/types/domain";

/**
 * POST /api/chat — SSE 流式对话端点（路由器）
 *
 * 请求 body：{ conversationId?: uuid|null, text: string (1-2000) }
 *
 * 工作流：
 *   1. 校验 + 限流 + 安全词
 *   2. 建/取 conversation（首次会话用 text 前 10 字做 title）
 *   3. classifyIntent (B 策略 = keyword + LLM 兜底)
 *   4. 写 user message + 更新 conversations.last_intent / last_message_at
 *   5. 分流：
 *      - intent === 'chat' → multi-turn 流式回复（带摘要 + 最近 K 条历史）
 *      - 其他 4 类 → 写引导卡 message → SSE 'card' 事件
 *   6. 异步触发 maybeSummarize
 *
 * SSE 事件：
 *   meta   { conversationId, intent, source }
 *   token  "<text chunk>"  (仅 chat)
 *   card   { id, role, content, metadata }  (4 类引导)
 *   done   {}
 *   error  { message }
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().min(1).nullish(),
  text: z.string().min(1, "消息不能为空").max(2000, "消息超过 2000 字"),
});

const SYSTEM_PROMPT = [
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
    return jsonError(parsed.error.issues[0]?.message ?? "校验失败", 400);
  }
  const { conversationId: incomingConvId, text } = parsed.data;

  const safetyFail = guardTexts({ text });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const limit = await checkRateLimit(userId);
  if (!limit.allowed) {
    return jsonError(
      `每小时上限 ${limit.limit} 条，请稍后再试（已发 ${limit.used}）`,
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

  const cls = await classifyIntent(text);
  const intent: Intent = cls.intent;

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

  const encoder = new TextEncoder();

  const sse = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        sseFrame(encoder, "meta", {
          conversationId: finalConvId,
          intent,
          source: cls.source,
        }),
      );

      try {
        if (intent === "chat") {
          await streamChatReply({
            controller,
            encoder,
            convId: finalConvId,
            userId,
            text,
          });
        } else {
          const cardMeta = buildGuideCard(intent);
          const [card] = await db
            .insert(messages)
            .values({
              conversation_id: finalConvId,
              role: "assistant",
              content: cardMeta.contentText,
              intent,
              metadata: serializeJson(cardMeta.meta),
            })
            .returning();
          controller.enqueue(
            sseFrame(encoder, "card", {
              id: card?.id,
              role: "assistant",
              content: cardMeta.contentText,
              metadata: serializeJson(cardMeta.meta),
            }),
          );
        }
        controller.enqueue(sseFrame(encoder, "done", {}));
      } catch (e) {
        console.error("/api/chat 失败", e);
        controller.enqueue(
          sseFrame(encoder, "error", {
            message: "AI 卡了一下，请稍后再试",
          }),
        );
      } finally {
        controller.close();
        void maybeSummarize(finalConvId);
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

interface GuideCard {
  contentText: string;
  meta: { ui: string; [k: string]: unknown };
}

function buildGuideCard(intent: Intent): GuideCard {
  switch (intent) {
    case "divination":
      return {
        contentText: "好的，您想求哪一类签？",
        meta: {
          ui: "slip_type_picker",
          options: [
            { key: "综合运势", label: "综合运势" },
            { key: "事业学业", label: "事业学业" },
            { key: "财运", label: "财运" },
            { key: "感情姻缘", label: "感情姻缘" },
            { key: "人际贵人", label: "人际贵人" },
            { key: "平安健康", label: "平安健康" },
          ],
        },
      };
    case "dream":
      return {
        contentText: "请问您想快速解梦还是精准解梦？",
        meta: {
          ui: "dream_choice",
          options: [
            { key: "fast", label: "快速解梦", hint: "简单描述 快速解梦" },
            { key: "precise", label: "精准解梦", hint: "多维度场景描述 精准解读" },
          ],
        },
      };
    case "bazi":
      return {
        contentText: "请填写八字信息",
        meta: { ui: "bazi_quick_form" },
      };
    case "meihua":
      return {
        contentText: "好的，请把您想测算的事情详细描述出来，越精准越好哦。",
        meta: { ui: "meihua_intro" },
      };
    default:
      return { contentText: "", meta: { ui: "text" } };
  }
}

async function streamChatReply(args: {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  convId: string;
  userId: string;
  text: string;
}) {
  const db = getDb();
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, args.convId))
    .limit(1);

  const recentRows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversation_id, args.convId))
    .orderBy(desc(messages.created_at))
    .limit(K_RECENT + 1);

  const recentExclSelf = recentRows
    .slice(1)
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const prompt = buildPromptMessages({
    systemPrompt: SYSTEM_PROMPT,
    summary: conv?.summary ?? null,
    recent: recentExclSelf,
    userText: args.text,
  });

  const modelMessages: ModelMessage[] = prompt
    .slice(1)
    .map((m) => ({ role: m.role, content: m.content }) as ModelMessage);

  const stream = await chat({
    messages: modelMessages,
    systemPrompt: SYSTEM_PROMPT,
    stream: true,
    meta: { conversationId: args.convId, userId: args.userId },
  });

  let assistantText = "";
  let tokens = 0;
  for await (const chunk of stream.textStream) {
    assistantText += chunk;
    args.controller.enqueue(sseFrame(args.encoder, "token", chunk));
  }
  try {
    tokens = (await stream.usage).totalTokens ?? 0;
  } catch {
    /* 拉不到 usage 不致命 */
  }

  await db.insert(messages).values({
    conversation_id: args.convId,
    role: "assistant",
    content: assistantText || "(无内容)",
    intent: "chat",
    tokens_used: tokens,
  });
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
    console.error("maybeSummarize failed", e);
  }
}

function sseFrame(encoder: TextEncoder, event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
