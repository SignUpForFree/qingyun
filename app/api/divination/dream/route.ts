import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { guardTexts } from "@/lib/safety/guard";
import { chat } from "@/lib/ai/client";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import { serializeJson } from "@/lib/db/json";
import {
  bumpConversationActivity,
  enforceRateLimit,
  jsonError,
  parseJsonBody,
  requireConversationOwned,
} from "@/lib/chat/route-helpers";
import { buildDreamPrompt, extractDreamSections } from "@/lib/ai/prompts/dream-interpret";

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
 * precise 模式 7 段结构（需求 §解梦内容）：
 *   🌙 开篇共情 → 🔮 三重维度解读(周公/弗洛伊德/荣格)
 *   → 📜 核心寓意 → 💡 规避方案 → 💌 潜意识真心话 → 🌷 结语
 */

// CLAUDE.md 第 1 条：ChatWindow 首次会话 convId 为 null，必须 .nullish()
const fastSchema = z.object({
  conversationId: z.string().min(1).nullish(),
  mode: z.literal("fast"),
  dream: z.string().trim().min(1).max(1000),
});

const preciseSchema = z.object({
  conversationId: z.string().min(1).nullish(),
  mode: z.literal("precise"),
  core: z.string().trim().min(1).max(500),
  emotion: z.string().trim().min(1).max(200),
  reality: z.string().trim().max(200).optional().default(""),
  special: z.string().trim().max(200).optional().default(""),
});

const bodySchema = z.discriminatedUnion("mode", [fastSchema, preciseSchema]);

/**
 * 解梦 prompt — 已拆到 lib/ai/prompts/dream-interpret.ts
 * （保留此处注释做导航）
 */

export async function POST(req: Request) {
  const body = await parseJsonBody(req, bodySchema);
  if (body.error) return body.error;
  const data = body.data;
  const conversationId = data.conversationId;
  if (!conversationId) {
    return jsonError("conversationId 必填（请先发起一条文本消息再使用解梦按钮）", 400);
  }

  const safetyText =
    data.mode === "fast"
      ? data.dream
      : [data.core, data.emotion, data.reality, data.special].join("\n");
  const safetyFail = guardTexts({ text: safetyText });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const limited = await enforceRateLimit(userId, "dream", "解梦 AI");
  if (limited) return limited;

  const db = getDb();
  const ownedFail = await requireConversationOwned(db, conversationId, userId);
  if (ownedFail) return ownedFail;

  const { systemPrompt: sysPrompt, userPrompt } = buildDreamPrompt({
    mode: data.mode,
    dream: data.mode === "fast" ? data.dream : undefined,
    core: data.mode === "precise" ? data.core : undefined,
    emotion: data.mode === "precise" ? data.emotion : undefined,
    reality: data.mode === "precise" ? data.reality : undefined,
    special: data.mode === "precise" ? data.special : undefined,
  });
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
    conversation_id: conversationId,
    role: "user",
    content: userText,
    intent: "dream",
  });

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
          conversationId: conversationId,
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
          meta: { conversationId: conversationId, userId },
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
            : (() => {
                const sections = extractDreamSections(finalText);
                return {
                  ui: "dream_result_precise" as const,
                  empathy: sections.empathy,
                  threeViews: sections.threeViews,
                  coreMeaning: sections.coreMeaning,
                  suggestions: sections.suggestions,
                  subconsciousMsg: sections.subconsciousMsg,
                  conclusion: sections.conclusion,
                  summary: finalText.slice(0, 200),
                };
              })();

        const [card] = await db
          .insert(messages)
          .values({
            conversation_id: conversationId,
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

        await bumpConversationActivity(db, conversationId, "dream");

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

    },
  });

  return new Response(sse, { headers: SSE_HEADERS });
}

