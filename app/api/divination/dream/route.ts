import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { chat } from "@/lib/ai/client";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import { serializeJson } from "@/lib/db/json";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_MS = 25_000;

/**
 * /api/divination/dream — 解梦 fast / precise 双模 (M2.18, spec §4.4)
 *
 * Body:
 *   - mode='fast'    : { conversationId, mode, dream }                   一段文本
 *   - mode='precise' : { conversationId, mode, core, emotion, reality?, special? }   4 字段
 *
 * 流程：
 *   1. 校验 + 限流 + 安全词
 *   2. 写 user message（fast → dream 文本；precise → 拼 4 字段）
 *   3. SSE meta → AI 流 → 写 dream_result_fast / dream_result_precise 卡
 *
 * 三视角解读（precise）：心理学 / 周公 / 现代实用建议（在 prompt 内分段，AI 自由组织文本）
 */

const fastSchema = z.object({
  conversationId: z.string().min(1),
  mode: z.literal("fast"),
  dream: z.string().trim().min(1).max(1000),
});

const preciseSchema = z.object({
  conversationId: z.string().min(1),
  mode: z.literal("precise"),
  core: z.string().trim().min(1).max(500),
  emotion: z.string().trim().min(1).max(200),
  reality: z.string().trim().max(200).optional().default(""),
  special: z.string().trim().max(200).optional().default(""),
});

const bodySchema = z.discriminatedUnion("mode", [fastSchema, preciseSchema]);

// M3.29: dream prompt 禁词锁与全站对齐 — CORE 6 词 + 解梦专属（凶兆/不祥）
const SYSTEM_PROMPT_FAST = [
  "你是温柔的解梦师。给用户一段简短回应。",
  "结构：1) 一句话点出主要意象；2) 一句话现代视角解读；3) 一句话行动建议。",
  "字数：100-200 字。语气温柔不武断。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然 / 凶兆 / 不祥。",
].join("\n");

const SYSTEM_PROMPT_PRECISE = [
  "你是资深解梦师，融合心理学 / 传统 / 现代视角。",
  "结构：[心理视角] 60-100 字 / [周公解梦] 60-100 字 / [现代实用建议] 60-100 字 / [总结一句] 1 句。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然 / 凶兆 / 不祥。",
  "负面信号转柔和说法（先慢一步、沉住气、宜稳）。",
  "用户填的 4 字段（核心场景/情绪/现实关联/特殊符号）请逐项呼应。",
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
  const data = parsed.data;

  const safetyText =
    data.mode === "fast"
      ? data.dream
      : [data.core, data.emotion, data.reality, data.special].join("\n");
  const safetyFail = guardTexts({ text: safetyText });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const limit = await checkRateLimit(userId, "dream");
  if (!limit.allowed) {
    return jsonError(
      `每小时解梦 AI 上限 ${limit.limit} 次，请稍后再试（已发 ${limit.used}）`,
      429,
    );
  }

  const db = getDb();
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, data.conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);

  const userPrompt = buildUserPrompt(data);
  const userText =
    data.mode === "fast"
      ? data.dream
      : [
          `核心场景：${data.core}`,
          `情绪感受：${data.emotion}`,
          data.reality ? `现实关联：${data.reality}` : "",
          data.special ? `特殊符号：${data.special}` : "",
        ]
          .filter(Boolean)
          .join("\n");

  await db.insert(messages).values({
    conversation_id: data.conversationId,
    role: "user",
    content: userText,
    intent: "dream",
  });

  const sysPrompt = data.mode === "fast" ? SYSTEM_PROMPT_FAST : SYSTEM_PROMPT_PRECISE;
  const resultUi = data.mode === "fast" ? "dream_result_fast" : "dream_result_precise";

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
          conversationId: data.conversationId,
          intent: "dream",
          mode: data.mode,
          source: "dream_api",
        }),
      );

      let aiText = "";
      let tokens = 0;

      try {
        const stream = await chat({
          systemPrompt: sysPrompt,
          messages: [{ role: "user", content: userPrompt }],
          stream: true,
          meta: { conversationId: data.conversationId, userId },
        });

        for await (const chunk of stream.textStream) {
          aiText += chunk;
          if (!safeEnqueue(controller, frame("token", chunk))) break;
        }
        try {
          tokens = (await stream.usage).totalTokens ?? 0;
        } catch {
          /* usage 不致命 */
        }

        // M3.34: 持久化前禁词兜底（含解梦专属"凶兆/不祥"）
        const sanitized = sanitizeAiOutput(aiText, "divination");
        const finalText = sanitized.cleaned || aiText || "(AI 解梦未生成)";
        if (sanitized.hitCount > 0 && process.env.NODE_ENV !== "production") {
          console.warn(
            `[dream] sanitizer hit ${sanitized.hitCount} forbidden words:`,
            sanitized.hitWords,
          );
        }

        const cardMeta =
          data.mode === "fast"
            ? { ui: "dream_result_fast" as const, summary: finalText }
            : {
                ui: "dream_result_precise" as const,
                threeViews: extractThreeViews(finalText),
                summary: finalText.slice(0, 200),
                suggestions: extractSuggestions(finalText),
              };

        const [card] = await db
          .insert(messages)
          .values({
            conversation_id: data.conversationId,
            role: "assistant",
            content: finalText,
            intent: "dream",
            metadata: serializeJson(cardMeta),
            tokens_used: tokens,
          })
          .returning();

        safeEnqueue(
          controller,
          frame("card", {
            id: card?.id,
            role: "assistant",
            content: finalText,
            metadata: serializeJson(cardMeta),
          }),
        );

        await db
          .update(conversations)
          .set({ last_intent: "dream", last_message_at: new Date().toISOString() })
          .where(eq(conversations.id, data.conversationId));

        safeEnqueue(controller, frame("done", {}));
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("/api/divination/dream 失败", e);
        }
        const isTimeout = e instanceof Error && /timeout|abort/i.test(e.message);
        safeEnqueue(
          controller,
          frame("error", {
            message: isTimeout ? "AI 演算超时，请重试" : "AI 卡了一下，请稍后再试",
            code: isTimeout ? "ai_timeout" : "unknown",
            retryable: true,
          }),
        );
      } finally {
        stopHeartbeat();
        try {
          controller.close();
        } catch {
          /* 已 close 不致命 */
        }
      }

      // suppress unused var lint
      void resultUi;
    },
  });

  return new Response(sse, { headers: SSE_HEADERS });
}

function buildUserPrompt(data: z.infer<typeof bodySchema>): string {
  if (data.mode === "fast") {
    return `用户的梦：${data.dream}\n\n请给一段简短温柔的解读。`;
  }
  return [
    `用户描述的梦境（4 字段）：`,
    `[核心场景] ${data.core}`,
    `[情绪感受] ${data.emotion}`,
    data.reality ? `[现实关联] ${data.reality}` : "",
    data.special ? `[特殊符号] ${data.special}` : "",
    "",
    "请按 [心理视角 / 周公解梦 / 现代实用建议 / 总结] 4 段输出。",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 从 AI 返回文本里粗粒度切出 3 视角文本。
 * AI 不严格遵守 4 段格式时尽量退化（split 失败 fallback 整段）。
 */
function extractThreeViews(text: string): {
  psychology: string;
  zhouGong: string;
  modern: string;
} {
  const tryFind = (label: RegExp) => {
    const m = text.match(label);
    if (!m) return "";
    const start = m.index ?? 0;
    const after = text.slice(start + m[0].length);
    // 取到下个 [ 标签或结束
    const stopMatch = after.match(/\[[^\]]+\]|总结/);
    const end = stopMatch ? stopMatch.index : after.length;
    return after.slice(0, end).trim();
  };

  return {
    psychology: tryFind(/\[心理视角\]/) || text,
    zhouGong: tryFind(/\[周公解梦\]/),
    modern: tryFind(/\[现代实用建议\]/),
  };
}

function extractSuggestions(text: string): string[] {
  // AI 可能用 - / 1. / • 等列表项；这里粗暴切
  return text
    .split(/\n[-•·\d.][\s)]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 100)
    .slice(0, 3);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
