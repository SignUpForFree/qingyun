import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { chat } from "@/lib/ai/client";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import { serializeJson } from "@/lib/db/json";
import { buildSlipPrompt, extractSlipSections } from "@/lib/ai/prompts/slip-interpret";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { enforceRateLimit, jsonError, parseJsonBody } from "@/lib/chat/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_MS = 25_000;

/**
 * /api/divination/qianwen/explain — 抽签 step3 AI 流式解读 (M2.17, spec §4.4)
 *
 * 输入 messageId：从 messages 表取出 slip_image 卡的 metadata（slipNumber/level/title/poem/category/reading）
 * 调 AI prompt → SSE token 流 → 完结后写 slip_report 卡（aiInterpretation = AI 文本）。
 *
 * 幂等性：同 messageId 已生成过 slip_report 直接返回旧结果（避免重复扣 token）。
 *
 * SSE：meta / token / card (slip_report) / done / error
 */

const bodySchema = z.object({
  messageId: z.string().min(1),
  fullInterpret: z.boolean().optional().default(false),
});

interface SlipImageMeta {
  ui: "slip_image";
  slipNumber: number;
  level: "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";
  title: string;
  poemLines: string[];
  category: string;
  reading: string;
  imageUrl?: string;
}

export async function POST(req: Request) {
  const body = await parseJsonBody(req, bodySchema);
  if (body.error) return body.error;
  const { messageId, fullInterpret } = body.data;

  const userId = await ensureUserId();
  const limited = await enforceRateLimit(userId, "divination", "解签 AI 调用");
  if (limited) return limited;

  const db = getDb();

  // 取 slip_image 消息 + 校验属于当前用户
  const rows = await db
    .select({
      id: messages.id,
      conversation_id: messages.conversation_id,
      metadata: messages.metadata,
      content: messages.content,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversation_id))
    .where(and(eq(messages.id, messageId), eq(conversations.user_id, userId)))
    .limit(1);

  const sourceMsg = rows[0];
  if (!sourceMsg) return jsonError("消息不存在或无权限", 404);

  let meta: SlipImageMeta;
  try {
    meta = JSON.parse(sourceMsg.metadata ?? "") as SlipImageMeta;
  } catch {
    return jsonError("源消息无 slip_image metadata", 400);
  }
  if (meta.ui !== "slip_image") {
    return jsonError(`源消息 ui 应为 slip_image，实为 ${meta.ui}`, 400);
  }

  const conversationId = sourceMsg.conversation_id;

  // 幂等：找 conversation 内是否已存在引用此 sourceMessageId 的 slip_report 消息
  const existingRows = await db
    .select({
      id: messages.id,
      content: messages.content,
      metadata: messages.metadata,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversation_id, conversationId),
        eq(messages.intent, "divination"),
      ),
    );

  for (const m of existingRows) {
    if (!m.metadata) continue;
    try {
      const mm = JSON.parse(m.metadata) as { ui?: string; sourceMessageId?: string };
      if (mm.ui === "slip_report" && mm.sourceMessageId === messageId) {
        // 已存在 — 返回普通 200 JSON 表示无 stream
        return Response.json({
          idempotent: true,
          card: {
            id: m.id,
            role: "assistant",
            content: m.content,
            metadata: m.metadata,
          },
        });
      }
    } catch {
      /* 坏 JSON 跳过 */
    }
  }

  // 构造 prompt（M3.4 抽到 lib/ai/prompts/slip-interpret.ts）
  const { systemPrompt, userPrompt } = buildSlipPrompt({
    slipNumber: meta.slipNumber,
    level: meta.level,
    title: meta.title,
    poemLines: meta.poemLines,
    category: meta.category,
    reading: meta.reading,
    isFullInterpret: fullInterpret,
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
          conversationId,
          intent: "divination",
          source: "explain",
          sourceMessageId: messageId,
        }),
      );

      let aiText = "";
      let tokens = 0;

      try {
        const stream = await chat({
          systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          stream: true,
          meta: { conversationId, userId },
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

        // M3.34: 持久化前禁词兜底（解签场景含"慎行/凶险"古风词）
        const sanitized = sanitizeAiOutput(aiText, "divination");
        const finalText = sanitized.cleaned || aiText || "(AI 解读未生成)";
        if (sanitized.hitCount > 0 && process.env.NODE_ENV !== "production") {
          console.warn(
            `[explain] sanitizer hit ${sanitized.hitCount} forbidden words:`,
            sanitized.hitWords,
          );
        }

        // 写 slip_report 卡
        const sections = extractSlipSections(finalText);
        const reportMeta = {
          ui: "slip_report" as const,
          slipNumber: meta.slipNumber,
          level: meta.level,
          title: meta.title,
          poem: meta.poemLines.join("，"),
          dimension: meta.category,
          reading: meta.reading,
          aiInterpretation: finalText,
          isFullInterpret: fullInterpret,
          sections,
          sourceMessageId: messageId,
        };

        const [card] = await db
          .insert(messages)
          .values({
            conversation_id: conversationId,
            role: "assistant",
            content: finalText,
            intent: "divination",
            metadata: serializeJson(reportMeta),
            tokens_used: tokens,
          })
          .returning();

        safeEnqueue(
          controller,
          frame("card", {
            id: card?.id,
            role: "assistant",
            content: finalText,
            metadata: serializeJson(reportMeta),
          }),
        );
        safeEnqueue(controller, frame("done", {}));
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("/api/divination/qianwen/explain 失败", e);
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
