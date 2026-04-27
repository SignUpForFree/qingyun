import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages, profiles } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { chat } from "@/lib/ai/client";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import { serializeJson } from "@/lib/db/json";

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

const bodySchema = z.object({
  conversationId: z.string().min(1),
  profileId: z.string().min(1).optional(),
  numbers: z.array(VALID_NUMBER).min(1).max(3).optional(),
  userQuestion: z.string().trim().max(200).optional(),
});

const SYSTEM_PROMPT = [
  "你是温和的梅花易数老师。",
  "结构：[卦象速断 60-100 字] / [体用关系 60-100 字] / [应期建议 60-100 字] / [行动建议 60-100 字]。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定。负面信号转柔和说法（先慢一步、沉住气）。",
  "字数：280-400 字。",
].join("\n");

// 后天八卦序号 1-8 → 卦名
const TRIGRAMS = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"] as const;
type Trigram = (typeof TRIGRAMS)[number];

const TRIGRAM_WUXING: Record<Trigram, "金" | "木" | "水" | "火" | "土"> = {
  乾: "金",
  兑: "金",
  离: "火",
  震: "木",
  巽: "木",
  坎: "水",
  艮: "土",
  坤: "土",
};

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

  const userId = await ensureUserId();
  const limit = await checkRateLimit(userId);
  if (!limit.allowed) {
    return jsonError(
      `每小时上限 ${limit.limit} 条，请稍后再试（已发 ${limit.used}）`,
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
          conversation_id: data.conversationId,
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

    const cardMeta = {
      ui: "profile_picker" as const,
      profiles: userProfiles.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isDefault: Boolean(p.isDefault),
        gender: (p.gender ?? "other") as "male" | "female" | "other",
        birthDate: p.birthDate ?? undefined,
      })),
      conversationId: data.conversationId,
      allowAddNew: true,
    };
    const [card] = await db
      .insert(messages)
      .values({
        conversation_id: data.conversationId,
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
        conversation_id: data.conversationId,
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

  const benGua = numbersToHexagram(numbers);
  const dongYao = computeDongYao(numbers);
  const bianGua = mutateHexagram(benGua, dongYao);
  const huGua = innerHexagram(benGua);
  const tiYong = computeTiYong(benGua, dongYao);
  const yingQi = computeYingQi(benGua, dongYao);

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
        const userPrompt = [
          `请按梅花易数解读：`,
          `档案性别：${profile.gender}`,
          `用户报数：${numbers.join(" / ")}`,
          `本卦：${benGua.upper}${benGua.lower}（上${benGua.upper}下${benGua.lower}）`,
          `互卦：${huGua.upper}${huGua.lower}`,
          `变卦：${bianGua.upper}${bianGua.lower}`,
          `动爻：第 ${dongYao} 爻`,
          `体用关系：${tiYong}`,
          `应期：${yingQi}`,
          userQuestion ? `用户问的：${userQuestion}` : "用户未指定具体问题，请综合解读。",
          "",
          "结构：卦象速断 / 体用关系 / 应期建议 / 行动建议（4 段）。",
        ].join("\n");

        safeEnqueue(controller, frame("progress", { stage: "streaming", percent: 40 }));

        const stream = await chat({
          systemPrompt: SYSTEM_PROMPT,
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

        const cardMeta = {
          ui: "meihua_result" as const,
          profileId,
          benGua: `${benGua.upper}${benGua.lower}`,
          huGua: `${huGua.upper}${huGua.lower}`,
          bianGua: `${bianGua.upper}${bianGua.lower}`,
          dongYao,
          tiYong,
          yingQi,
          verdict: aiText.slice(0, 60) || "(AI 卦辞未生成)",
          aiText,
        };

        const [card] = await db
          .insert(messages)
          .values({
            conversation_id: data.conversationId,
            role: "assistant",
            content: aiText || "(AI 卦辞未生成)",
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
            content: aiText,
            metadata: serializeJson(cardMeta),
          }),
        );

        await db
          .update(conversations)
          .set({ last_intent: "meihua", last_message_at: new Date().toISOString() })
          .where(eq(conversations.id, data.conversationId));

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

// ============ V1.0 简化算法（V2.0 在 M3.16+ 升级） ============

/**
 * 报数 → 本卦
 * 单数：上卦 = (n % 8) || 8；下卦同 n；动爻 = (n % 6) || 6
 * 双数：上卦 = (n1 % 8) || 8；下卦 = (n2 % 8) || 8；动爻 = ((n1+n2) % 6) || 6
 * 三数：上卦 = (n1 % 8) || 8；下卦 = (n2 % 8) || 8；动爻 = ((n1+n2+n3) % 6) || 6
 */
function numbersToHexagram(numbers: number[]): { upper: Trigram; lower: Trigram } {
  const n1 = numbers[0] ?? 1;
  const n2 = numbers[1] ?? n1;
  const upperIdx = ((n1 - 1) % 8 + 8) % 8;
  const lowerIdx = ((n2 - 1) % 8 + 8) % 8;
  return { upper: TRIGRAMS[upperIdx]!, lower: TRIGRAMS[lowerIdx]! };
}

function computeDongYao(numbers: number[]): number {
  const sum = numbers.reduce((a, b) => a + b, 0);
  const r = sum % 6;
  return r === 0 ? 6 : r;
}

/**
 * 互卦：取本卦 234 爻为下卦、345 爻为上卦
 * V1.0 简化：直接拿本卦的 lower / upper 反过来作互卦 placeholder（后续 V2 接 64 卦表）
 */
function innerHexagram(ben: { upper: Trigram; lower: Trigram }): { upper: Trigram; lower: Trigram } {
  return { upper: ben.lower, lower: ben.upper };
}

/**
 * 变卦：动爻所在卦换一个相邻位（V1.0 简化：上下卦互换 placeholder）
 */
function mutateHexagram(
  ben: { upper: Trigram; lower: Trigram },
  dongYao: number,
): { upper: Trigram; lower: Trigram } {
  // 动爻 1-3 影响下卦，4-6 影响上卦
  if (dongYao <= 3) {
    const idx = TRIGRAMS.indexOf(ben.lower);
    return { upper: ben.upper, lower: TRIGRAMS[(idx + 1) % 8]! };
  }
  const idx = TRIGRAMS.indexOf(ben.upper);
  return { upper: TRIGRAMS[(idx + 1) % 8]!, lower: ben.lower };
}

/**
 * 体用关系：动爻所在卦为用，另一卦为体
 * 比较 wuxing 给出生克关系（生体 / 比和 / 体生用 / 克体 / 体克用）
 */
function computeTiYong(ben: { upper: Trigram; lower: Trigram }, dongYao: number): string {
  const ti = dongYao <= 3 ? ben.upper : ben.lower; // 不动的为体
  const yong = dongYao <= 3 ? ben.lower : ben.upper;
  const tiE = TRIGRAM_WUXING[ti];
  const yongE = TRIGRAM_WUXING[yong];

  if (tiE === yongE) return `比和（${ti}/${yong} 同${tiE}），运势平稳`;
  if (sheng(yongE, tiE)) return `用生体（${yong}${yongE} 生 ${ti}${tiE}），得力`;
  if (sheng(tiE, yongE)) return `体生用（${ti}${tiE} 生 ${yong}${yongE}），耗力`;
  if (ke(yongE, tiE)) return `用克体（${yong}${yongE} 克 ${ti}${tiE}），先慢一步`;
  if (ke(tiE, yongE)) return `体克用（${ti}${tiE} 克 ${yong}${yongE}），主导`;
  return `${ti}${tiE} / ${yong}${yongE}，需结合时运`;
}

/**
 * 应期：动爻数对应当下 / 近期 / 中期
 */
function computeYingQi(_ben: { upper: Trigram; lower: Trigram }, dongYao: number): string {
  if (dongYao <= 2) return "近 1-3 日";
  if (dongYao <= 4) return "近 1-3 周";
  return "1-3 个月";
}

function sheng(a: string, b: string): boolean {
  // 五行相生：木→火→土→金→水→木
  return (
    (a === "木" && b === "火") ||
    (a === "火" && b === "土") ||
    (a === "土" && b === "金") ||
    (a === "金" && b === "水") ||
    (a === "水" && b === "木")
  );
}

function ke(a: string, b: string): boolean {
  // 五行相克：木克土，土克水，水克火，火克金，金克木
  return (
    (a === "木" && b === "土") ||
    (a === "土" && b === "水") ||
    (a === "水" && b === "火") ||
    (a === "火" && b === "金") ||
    (a === "金" && b === "木")
  );
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
