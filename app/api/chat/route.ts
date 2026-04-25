import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
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
 * 流程：
 *   1. 校验 + auth
 *   2. 限流（按 user 30/h）
 *   3. classifyIntent (规则层)
 *   4. 没 conversationId → 建一个，title 用 text 前 10 字
 *   5. 落 user message
 *   6. 调 chat({ stream: true }) → 边读边发 SSE token 事件
 *   7. 流结束后异步落 assistant message + 更新 conversations.last_message_at
 *
 * SSE 事件：
 *   event: meta   data: { conversationId, intent }
 *   event: token  data: "<chunk text>"
 *   event: done   data: {}
 *   event: error  data: { message }
 *
 * P1 仅做通用 chat 兜底；P2 G 节会按 intent 切到不同 prompt + handler。
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  text: z.string().min(1, "消息不能为空").max(2000, "消息超过 2000 字"),
  intentHint: z.enum(["chat", "divination", "dream", "bazi", "meihua"]).optional(),
});

const FALLBACK_SYSTEM_PROMPT = [
  "你是轻运 AI，一位温柔、年轻化的国学陪伴助手。",
  "回复风格：自然、简短（默认 80–200 字），有温度但不端说教架子。",
  "禁用：大凶 / 倒霉 / 厄运 / 命中注定 等绝对负面词。把不利信号转成‘适合静一静’、‘可以慢一点’这类柔和说法。",
  "结尾不要硬贴‘加油’、‘相信自己’这种空洞鸡汤。",
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

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonError("未登录", 401);
  }

  // 限流：按 user 维度统计 messages.role='user' 一小时内条数
  const admin = createAdmin();
  const deps: CountUserMessagesDeps = {
    countUserMessages: async (userId, sinceIso) => {
      const { count, error } = await admin
        .from("messages")
        .select("id, conversations!inner(user_id)", { count: "exact", head: true })
        .eq("role", "user")
        .gte("created_at", sinceIso)
        .eq("conversations.user_id", userId);
      if (error) throw error;
      return count ?? 0;
    },
  };
  const limit = await isWithinLimit(user.id, deps);
  if (!limit.allowed) {
    return jsonError(
      `每小时上限 ${limit.limit} 条，请稍后再试（已发 ${limit.used}）`,
      429,
    );
  }

  const intent: Intent = classifyIntent(text, { hint: intentHint });

  // 建/取 conversation
  let convId = incomingConvId ?? null;
  if (!convId) {
    const insertConv = {
      user_id: user.id,
      profile_id: null,
      title: text.slice(0, 10),
    };
    const { data: convData, error: convErr } = await supabase
      .from("conversations")
      .insert(insertConv as never)
      .select("id")
      .single();
    if (convErr || !convData) {
      console.error("conversations insert 失败", convErr);
      return jsonError("创建会话失败", 500);
    }
    convId = (convData as { id: string }).id;
  }
  const finalConvId: string = convId;

  // 落 user message
  const userMessage = {
    conversation_id: finalConvId,
    role: "user" as const,
    content: text,
    intent,
  };
  const { error: insertUserErr } = await supabase
    .from("messages")
    .insert(userMessage as never);
  if (insertUserErr) {
    console.error("user message insert 失败", insertUserErr);
    return jsonError("消息保存失败", 500);
  }

  // 调 AI Gateway 流式
  const stream = await chat({
    messages: [{ role: "user", content: text }],
    systemPrompt: FALLBACK_SYSTEM_PROMPT,
    stream: true,
    meta: { conversationId: finalConvId, userId: user.id },
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

        // 落 assistant message + 更新会话时间戳（非阻塞，admin 绕 RLS）
        try {
          const assistantRow = {
            conversation_id: finalConvId,
            role: "assistant" as const,
            content: assistantText || "(无内容)",
            intent,
            tokens_used: totalTokens,
          };
          await admin.from("messages").insert(assistantRow as never);
          await admin
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() } as never)
            .eq("id", finalConvId);
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
      "X-Accel-Buffering": "no", // 关键：让 nginx / 微信 X5 不缓冲
    },
  });
}

function sseFrame(encoder: TextEncoder, event: string, data: unknown): Uint8Array {
  // client 一律 JSON.parse(data)：string chunk 走 stringify('xxx') → '"xxx"'，
  // object 走 stringify({...}) 一次。注意不要双 stringify。
  const payload = JSON.stringify(data);
  return encoder.encode(`event: ${event}\ndata: ${payload}\n\n`);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
