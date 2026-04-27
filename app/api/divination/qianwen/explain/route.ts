import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { chat } from "@/lib/ai/client";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import { serializeJson } from "@/lib/db/json";

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
});

const SYSTEM_PROMPT = [
  "你是轻运 AI 的资深解签师。",
  "解签风格：温和、具体、不空泛；从签诗 4 句逐句意象出发，结合用户问的问题给出建议。",
  "结构：开场一句呼应问题 + 4 段（按签诗 4 句）+ 收尾一句行动建议。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定。负面信号转柔和说法（先慢一步、沉住气）。",
  "字数：300-500 字。",
].join("\n");

interface SlipImageMeta {
  ui: "slip_image";
  slipNumber: number;
  level: "上上" | "上吉" | "中吉" | "中平" | "下下";
  title: string;
  poemLines: string[];
  category: string;
  reading: string;
  imageUrl?: string;
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
  const { messageId } = parsed.data;

  const userId = await ensureUserId();
  const limit = await checkRateLimit(userId);
  if (!limit.allowed) {
    return jsonError(
      `每小时上限 ${limit.limit} 条，请稍后再试（已发 ${limit.used}）`,
      429,
    );
  }

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

  // 构造 prompt
  const userPrompt = [
    `第 ${meta.slipNumber} 签 · ${meta.level} · 《${meta.title}》`,
    `签诗：`,
    ...meta.poemLines.map((l, i) => `${i + 1}. ${l}`),
    "",
    `问的方向：${meta.category}`,
    `静态解签词参考：${meta.reading}`,
    "",
    "请按 [开场→4 段意象→收尾] 结构生成 300-500 字解读。",
  ].join("\n");

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
          systemPrompt: SYSTEM_PROMPT,
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

        // 写 slip_report 卡
        const reportMeta = {
          ui: "slip_report" as const,
          slipNumber: meta.slipNumber,
          level: meta.level,
          title: meta.title,
          poem: meta.poemLines.join("，"),
          dimension: meta.category,
          reading: meta.reading,
          aiInterpretation: aiText || "(AI 解读未生成)",
          sourceMessageId: messageId,
        };

        const [card] = await db
          .insert(messages)
          .values({
            conversation_id: conversationId,
            role: "assistant",
            content: aiText || "(AI 解读未生成)",
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
            content: aiText,
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

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
