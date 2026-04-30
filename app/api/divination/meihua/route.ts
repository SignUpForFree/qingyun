import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages, profiles } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { guardTexts } from "@/lib/safety/guard";
import { chat } from "@/lib/ai/client";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import { serializeJson } from "@/lib/db/json";
import { meihuaV2 } from "@/lib/divination/meihua-v2";
import { buildMeihuaPrompt } from "@/lib/ai/prompts/meihua-interpret";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import {
  bumpConversationActivity,
  enforceRateLimit,
  jsonError,
  parseJsonBody,
  requireConversationOwned,
} from "@/lib/chat/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_MS = 25_000;

/**
 * /api/divination/meihua — 梅花易数 (M2.20, spec §4.4)
 *
 * 多分支 body schema：
 *  A) { conversationId } only                 → 列档案 / 引导建档
 *     - 有任意 profile → profile_picker 卡（A3 多档案）
 *     - 无 profile     → bazi_quick_form 卡（先建档再起卦）
 *  B) { conversationId, profileId }           → meihua_number_input 卡（让用户报数）
 *  C) { conversationId, profileId, numbers, userQuestion? } → SSE → meihua_result 卡
 *
 * V1.0 的算法是简化版（先把 8 卦 / 体用 / 应期 placeholder 送进 AI prompt，AI 自由发挥）。
 * V2.0 五行损益 / 时辰能量加权在 M3.16+ 升级 lib/divination/meihua-v2.ts。
 */

const VALID_NUMBER = z.number().int().min(1).max(999);

// CLAUDE.md 第 1 条：ChatWindow 首次会话 convId 为 null，必须 .nullish()
const bodySchema = z.object({
  conversationId: z.string().min(1).nullish(),
  profileId: z.string().min(1).optional(),
  numbers: z.array(VALID_NUMBER).min(1).max(3).optional(),
  userQuestion: z.string().trim().max(200).optional(),
});

// V1 SYSTEM_PROMPT / TRIGRAMS / TRIGRAM_WUXING 已移到 lib/ai/prompts/meihua-interpret.ts
// 与 lib/divination/meihua-v2.ts，本路由专心做 SSE + DB

export async function POST(req: Request) {
  const body = await parseJsonBody(req, bodySchema);
  if (body.error) return body.error;
  const data = body.data;
  const conversationId = data.conversationId;
  if (!conversationId) {
    return jsonError("conversationId 必填（请先发起一条文本消息再使用梅花按钮）", 400);
  }

  const userId = await ensureUserId();
  const limited = await enforceRateLimit(userId, "meihua", "梅花 AI 解卦");
  if (limited) return limited;

  const db = getDb();
  const ownedFail = await requireConversationOwned(db, conversationId, userId);
  if (ownedFail) return ownedFail;

  // ============ Branch A: 仅 conversationId — 列档案 / 引导建档 ============
  if (!data.profileId) {
    const userProfiles = await db
      .select({
        id: profiles.id,
        nickname: profiles.nickname,
        isDefault: profiles.is_default,
        gender: profiles.gender,
        birthDate: profiles.birth_date,
      })
      .from(profiles)
      .where(eq(profiles.user_id, userId));

    if (userProfiles.length === 0) {
      const cardMeta = {
        ui: "bazi_quick_form" as const,
        fields: ["gender", "birth_time", "birth_place"],
        reason: "起梅花卦先要档案信息，做好后回来报数。",
      };
      const [card] = await db
        .insert(messages)
        .values({
          conversation_id: conversationId,
          role: "assistant",
          content: "起梅花卦先要您的档案，请填一下",
          intent: "meihua",
          metadata: serializeJson(cardMeta),
        })
        .returning();
      return Response.json({
        step: "quick_form_needed",
        card: {
          id: card?.id,
          role: "assistant",
          content: "起梅花卦先要您的档案，请填一下",
          metadata: serializeJson(cardMeta),
        },
      });
    }

    // 已绑定档案 fast-path（防止 client 漏传 profileId 时倒退到 picker）
    const bound = await db
      .select({ profile_id: conversations.profile_id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    const boundId = bound[0]?.profile_id;
    const boundExists = boundId ? userProfiles.some((p) => p.id === boundId) : false;

    // 单档案 fast-path 或 已绑定档案 fast-path：直接进报数环节
    if (userProfiles.length === 1 || boundExists) {
      const onlyId = boundExists ? boundId! : userProfiles[0]!.id;
      const cardMeta = {
        ui: "meihua_number_input" as const,
        profileId: onlyId,
        numberCount: 3,
      };
      const [card] = await db
        .insert(messages)
        .values({
          conversation_id: conversationId,
          role: "assistant",
          content: "请报 3 个 1-999 之间的随机数（也可只报 1-2 个）",
          intent: "meihua",
          metadata: serializeJson(cardMeta),
        })
        .returning();
      return Response.json({
        step: "number_input",
        profileId: onlyId,
        card: {
          id: card?.id,
          role: "assistant",
          content: "请报 3 个 1-999 之间的随机数（也可只报 1-2 个）",
          metadata: serializeJson(cardMeta),
        },
      });
    }

    const cardMeta = {
      ui: "profile_picker" as const,
      intent: "meihua" as const,
      profiles: userProfiles.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isDefault: Boolean(p.isDefault),
        gender: (p.gender ?? "other") as "male" | "female" | "other",
        birthDate: p.birthDate ?? undefined,
      })),
      conversationId: conversationId,
      allowAddNew: true,
    };
    const [card] = await db
      .insert(messages)
      .values({
        conversation_id: conversationId,
        role: "assistant",
        content: "用谁的档案起卦？",
        intent: "meihua",
        metadata: serializeJson(cardMeta),
      })
      .returning();
    return Response.json({
      step: "profile_picker",
      card: {
        id: card?.id,
        role: "assistant",
        content: "用谁的档案起卦？",
        metadata: serializeJson(cardMeta),
      },
    });
  }

  // 校验 profile 属于当前用户（B/C 都需要）
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, data.profileId), eq(profiles.user_id, userId)))
    .limit(1);
  if (!profile) return jsonError("档案不存在或无权限", 404);

  // ============ Branch B: profileId 但无 numbers → meihua_number_input 卡 ============
  if (!data.numbers || data.numbers.length === 0) {
    const cardMeta = {
      ui: "meihua_number_input" as const,
      profileId: data.profileId,
      numberCount: 3,
    };
    const [card] = await db
      .insert(messages)
      .values({
        conversation_id: conversationId,
        role: "assistant",
        content: "请报 3 个 1-999 之间的随机数（也可只报 1-2 个）",
        intent: "meihua",
        metadata: serializeJson(cardMeta),
      })
      .returning();
    return Response.json({
      step: "number_input",
      card: {
        id: card?.id,
        role: "assistant",
        content: "请报 3 个 1-999 之间的随机数（也可只报 1-2 个）",
        metadata: serializeJson(cardMeta),
      },
    });
  }

  // ============ Branch C: profileId + numbers → 起卦 + SSE 流 ============
  if (data.userQuestion) {
    const safetyFail = guardTexts({ text: data.userQuestion });
    if (safetyFail) return safetyFail;
  }

  const profileId = data.profileId;
  const numbers = data.numbers;
  const userQuestion = data.userQuestion ?? "";

  // M3.23：用 V2 算法（5 卦推演 + 体用 + 时辰能量 + 五行损益 + 应期 +
  // 64 卦字典 panci/yaoci/tuanci）替代 V1 内联简化算法
  const v2 = meihuaV2({
    numbers,
    userQuestion,
    profile: {
      id: profile.id,
      gender: profile.gender,
      birth_date: profile.birth_date,
      birth_time: profile.birth_time,
      bazi_pillars: profile.bazi_pillars,
    },
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
          intent: "meihua",
          profileId,
          numbers,
          source: "meihua_api",
        }),
      );

      safeEnqueue(controller, frame("progress", { stage: "computing", percent: 20 }));

      let aiText = "";
      let tokens = 0;

      try {
        const { systemPrompt, userPrompt } = buildMeihuaPrompt({
          result: v2,
          userQuestion,
        });

        safeEnqueue(controller, frame("progress", { stage: "streaming", percent: 40 }));

        const stream = await chat({
          systemPrompt,
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

        // M3.34: 持久化前禁词兜底
        const sanitized = sanitizeAiOutput(aiText, "divination");
        const finalText = sanitized.cleaned || aiText || "(AI 卦辞未生成)";
        if (sanitized.hitCount > 0 && process.env.NODE_ENV !== "production") {
          console.warn(
            `[meihua] sanitizer hit ${sanitized.hitCount} forbidden words:`,
            sanitized.hitWords,
          );
        }

        const cardMeta = {
          ui: "meihua_result" as const,
          profileId,
          numbers,
          // V2 5 卦推演：每卦含 number/name/upper/lower/lines
          ben: { name: v2.ben.name, upper: v2.ben.upper, lower: v2.ben.lower, lines: v2.ben.lines },
          hu: { name: v2.hu.name, upper: v2.hu.upper, lower: v2.hu.lower, lines: v2.hu.lines },
          bian: { name: v2.bian.name, upper: v2.bian.upper, lower: v2.bian.lower, lines: v2.bian.lines },
          guaZhongGua: {
            name: v2.guaZhongGua.name,
            upper: v2.guaZhongGua.upper,
            lower: v2.guaZhongGua.lower,
            lines: v2.guaZhongGua.lines,
          },
          dongYao: v2.dongYao,
          // 体用 / 应期 / 时辰能量 / 五行损益（V2 新增）
          tiYong: v2.tiYong,
          yingQi: v2.yingQi,
          timeEnergy: v2.timeEnergy,
          sunYi: v2.sunYi,
          // gua64 字典视图（动爻爻辞 + 卦辞 + 彖辞），前端可直接渲染
          benDict: v2.benDict,
          huDict: v2.huDict,
          bianDict: v2.bianDict,
          verdict: finalText.slice(0, 60) || "(AI 卦辞未生成)",
          aiText: finalText,
        };

        const [card] = await db
          .insert(messages)
          .values({
            conversation_id: conversationId,
            role: "assistant",
            content: finalText,
            intent: "meihua",
            metadata: serializeJson(cardMeta),
            tokens_used: tokens,
            profile_id_used: profileId,
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

        await bumpConversationActivity(db, conversationId, "meihua");

        safeEnqueue(controller, frame("done", {}));
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("/api/divination/meihua 失败", e);
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
