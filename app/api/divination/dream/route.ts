import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { messages, profiles } from "@/lib/db/schema";
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
  if (safetyFail) return jsonError("检测到您提交的内容包含敏感或违规信息，请修改后重试", 400);

  const userId = await ensureUserId();
  const limited = await enforceRateLimit(userId, "dream", "解梦 AI");
  if (limited) return limited;

  const db = getDb();
  const ownedFail = await requireConversationOwned(db, conversationId, userId);
  if (ownedFail) return ownedFail;

  // 需求：梦境内容有效性校验 — 快速模式至少 2 字
  if (data.mode === "fast") {
    const dream = data.dream.trim();
    if (dream.length < 2) {
      return jsonError("您描述的梦境内容无效或不够详细，请详细描述真实梦境，以便我能为您详细精准解读梦境", 400);
    }
  }

  const { systemPrompt: sysPrompt, userPrompt } = buildDreamPrompt({
    mode: data.mode,
    dream: data.mode === "fast" ? data.dream : undefined,
    core: data.mode === "precise" ? data.core : undefined,
    emotion: data.mode === "precise" ? data.emotion : undefined,
    reality: data.mode === "precise" ? data.reality : undefined,
    special: data.mode === "precise" ? data.special : undefined,
    baziHint: await getBaziHint(userId),
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
                if (process.env.NODE_ENV !== "production") {
                  console.log("[dream precise] sections:", JSON.stringify({
                    empathy: sections.empathy?.slice(0, 40),
                    zhouGong: sections.threeViews.zhouGong?.slice(0, 40),
                    coreMeaning: sections.coreMeaning?.slice(0, 40),
                    suggestions: sections.suggestions?.length,
                    subconsciousMsg: sections.subconsciousMsg?.slice(0, 40),
                    conclusion: sections.conclusion?.slice(0, 40),
                  }));
                }
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

/**
 * 读取用户默认档案的八字信息，返回简短提示词片段。
 * 需求要求"结合生辰八字进行解梦"。
 */
async function getBaziHint(userId: string): Promise<string | undefined> {
  try {
    const db = getDb();
    const [profile] = await db
      .select({
        gender: profiles.gender,
        birth_date: profiles.birth_date,
        birth_time: profiles.birth_time,
        bazi_pillars: profiles.bazi_pillars,
      })
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1);
    if (!profile) return undefined;

    const parts: string[] = [];
    if (profile.birth_date) parts.push(`出生日期：${profile.birth_date}`);
    if (profile.birth_time) parts.push(`出生时辰：${profile.birth_time}`);
    if (profile.gender) parts.push(`性别：${profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : ""}`);

    // 如果有缓存的八字柱信息，直接用
    if (profile.bazi_pillars) {
      try {
        const cached = JSON.parse(profile.bazi_pillars) as { pillars?: { year?: { gan?: string; zhi?: string }; month?: { gan?: string; zhi?: string }; day?: { gan?: string; zhi?: string }; hour?: { gan?: string; zhi?: string } } };
        if (cached.pillars) {
          const p = cached.pillars;
          parts.push(`八字：${p.year?.gan ?? ""}${p.year?.zhi ?? ""} ${p.month?.gan ?? ""}${p.month?.zhi ?? ""} ${p.day?.gan ?? ""}${p.day?.zhi ?? ""} ${p.hour?.gan ?? ""}${p.hour?.zhi ?? ""}`);
        }
      } catch { /* 坏 JSON 跳过 */ }
    }

    return parts.length > 0 ? parts.join("，") : undefined;
  } catch {
    return undefined;
  }
}

