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
import { buildChartV2 } from "@/lib/bazi/chart";
import { buildBaziPrompt, type V2DivinationDim } from "@/lib/ai/prompts/bazi-interpret";
import { parsePillarsCache, serializePillars } from "@/lib/profile/bazi-pillars";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_MS = 25_000;

/**
 * /api/divination/bazi — 八字端点 (M2.19, spec §4.4)
 *
 * 多分支 body schema：
 *  A) { conversationId } only           → 列档案 / 引导建档
 *     - 有任意 profile → profile_picker 卡
 *     - 无 profile     → bazi_quick_form 卡
 *  B) { conversationId, quickFormData } → quick_form 提交：建默认档案 → focus_picker 卡
 *  C) { conversationId, profileId }     → bazi_focus_picker 卡
 *  D) { conversationId, profileId, focus } → SSE 流 → bazi_result 卡
 *
 * AI 解读用 lib/bazi/chart 已有 buildChart（V2.0 算法升级是 M3）。
 * 缺 lat/lng 时用上海大致坐标 31.23/121.47 兜底（M3 上 IP geo 后细化）。
 */

const VALID_CATEGORIES = [
  "综合",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

const quickFormSchema = z.object({
  gender: z.enum(["male", "female"]),
  birth_time: z.string().min(1).max(50),
  birth_place: z.string().min(1).max(60),
});

const bodySchema = z.object({
  conversationId: z.string().min(1),
  profileId: z.string().min(1).optional(),
  focus: z.enum(VALID_CATEGORIES).optional(),
  quickFormData: quickFormSchema.optional(),
});

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
  const limit = await checkRateLimit(userId, "bazi");
  if (!limit.allowed) {
    return jsonError(
      `每小时八字 AI 解读上限 ${limit.limit} 次，请稍后再试（已发 ${limit.used}）`,
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

  // ============ Branch B: quickFormData → 创建档案 ============
  if (data.quickFormData) {
    const safetyFail = guardTexts({
      text: `${data.quickFormData.birth_time} ${data.quickFormData.birth_place}`,
    });
    if (safetyFail) return safetyFail;

    const { dateOnly, timeOnly } = splitDateTime(data.quickFormData.birth_time);

    const newProfileId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.transaction((tx) => {
      // 已有 profile 则不抢默认；新档案 is_default 视情况而定
      const exist = tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.user_id, userId))
        .limit(1)
        .all();
      const isDefault = exist.length === 0;
      tx.insert(profiles)
        .values({
          id: newProfileId,
          user_id: userId,
          is_default: isDefault,
          nickname: "我自己",
          gender: data.quickFormData!.gender,
          birth_date: dateOnly,
          birth_time: timeOnly,
          birth_calendar: "solar",
          birth_place: data.quickFormData!.birth_place,
          created_at: now,
          updated_at: now,
        })
        .run();
    });

    // profile 已建 → 写 focus_picker 卡返回（让前端继续选 focus）
    const cardMeta = {
      ui: "bazi_focus_picker" as const,
      profileId: newProfileId,
      options: VALID_CATEGORIES.map((k) => ({ key: k, label: k })),
    };
    const [card] = await db
      .insert(messages)
      .values({
        conversation_id: data.conversationId,
        role: "assistant",
        content: "档案已建好，您想从哪个角度看？",
        intent: "bazi",
        metadata: serializeJson(cardMeta),
      })
      .returning();

    return Response.json({
      step: "profile_created_focus_picker",
      profileId: newProfileId,
      card: {
        id: card?.id,
        role: "assistant",
        content: "档案已建好，您想从哪个角度看？",
        metadata: serializeJson(cardMeta),
      },
    });
  }

  // ============ Branch A: 仅 conversationId — 列档案 / 引导建档 ============
  if (!data.profileId && !data.focus) {
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
      const cardMeta = { ui: "bazi_quick_form" as const, fields: ["gender", "birth_time", "birth_place"] };
      const [card] = await db
        .insert(messages)
        .values({
          conversation_id: data.conversationId,
          role: "assistant",
          content: "请填写八字信息",
          intent: "bazi",
          metadata: serializeJson(cardMeta),
        })
        .returning();
      return Response.json({
        step: "quick_form_needed",
        card: {
          id: card?.id,
          role: "assistant",
          content: "请填写八字信息",
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
        content: "用谁的档案算八字？",
        intent: "bazi",
        metadata: serializeJson(cardMeta),
      })
      .returning();
    return Response.json({
      step: "profile_picker",
      card: {
        id: card?.id,
        role: "assistant",
        content: "用谁的档案算八字？",
        metadata: serializeJson(cardMeta),
      },
    });
  }

  // ============ Branch C: profileId 但无 focus → focus_picker 卡 ============
  if (data.profileId && !data.focus) {
    // 校验 profile 属于当前用户
    const [prof] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.id, data.profileId), eq(profiles.user_id, userId)))
      .limit(1);
    if (!prof) return jsonError("档案不存在或无权限", 404);

    const cardMeta = {
      ui: "bazi_focus_picker" as const,
      profileId: data.profileId,
      options: VALID_CATEGORIES.map((k) => ({ key: k, label: k })),
    };
    const [card] = await db
      .insert(messages)
      .values({
        conversation_id: data.conversationId,
        role: "assistant",
        content: "好的，您想从哪个角度看八字？",
        intent: "bazi",
        metadata: serializeJson(cardMeta),
      })
      .returning();
    return Response.json({
      step: "focus_picker",
      card: {
        id: card?.id,
        role: "assistant",
        content: "好的，您想从哪个角度看八字？",
        metadata: serializeJson(cardMeta),
      },
    });
  }

  // ============ Branch D: profileId + focus → SSE 流式生成 bazi_result ============
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, data.profileId!), eq(profiles.user_id, userId)))
    .limit(1);
  if (!profile) return jsonError("档案不存在或无权限", 404);

  const focus = data.focus!;
  const profileId = data.profileId!;

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
          intent: "bazi",
          profileId,
          focus,
          source: "bazi_api",
        }),
      );

      // progress event 通知前端"开始演算"
      safeEnqueue(controller, frame("progress", { stage: "computing", percent: 10 }));

      let aiText = "";
      let tokens = 0;

      try {
        // M3.13: V2 算盘 — 真太阳时 + 30+ 神煞 + 大运 8 步 + 流年 5 年 + 用神
        const chartV2 = buildChartV2(
          {
            birthTime: parseBirthDateTime(profile.birth_date, profile.birth_time),
            longitude: 121.47, // 上海兜底（M3 后续接 IP geo / 出生地查表）
            latitude: 31.23,
            gender: (profile.gender ?? "male") as "male" | "female",
            calendarType: profile.birth_calendar,
          },
          { centerYear: new Date().getUTCFullYear() },
        );

        // M3.15: 把 pillars + 真太阳时写回 profile.bazi_pillars 缓存（fire-and-forget）
        // 仅在缓存空 / 非法时写，避免无谓 update
        if (!parsePillarsCache(profile.bazi_pillars)) {
          try {
            db.update(profiles)
              .set({
                bazi_pillars: serializePillars({
                  pillars: chartV2.pillars,
                  solarTrueTime: chartV2.solarTrueTime,
                }),
                updated_at: new Date().toISOString(),
              })
              .where(eq(profiles.id, profileId))
              .run();
          } catch (cacheErr) {
            // 缓存写失败不阻塞主路径
            if (process.env.NODE_ENV !== "production") {
              console.error("写 bazi_pillars 缓存失败", cacheErr);
            }
          }
        }

        const { systemPrompt, userPrompt } = buildBaziPrompt({
          chart: chartV2,
          focus: focus as V2DivinationDim,
          profile: {
            gender: (profile.gender ?? "male") as "male" | "female",
            birthDate: profile.birth_date,
            birthTime: profile.birth_time,
            birthPlace: profile.birth_place,
            calendarType: profile.birth_calendar,
          },
        });

        safeEnqueue(controller, frame("progress", { stage: "streaming", percent: 30 }));

        const stream = await chat({
          systemPrompt,
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
          ui: "bazi_result" as const,
          profileId,
          focus,
          chart: {
            pillars: chartV2.pillars,
            fiveElements: chartV2.fiveElements,
            dayMaster: chartV2.dayMaster,
            tenGods: chartV2.tenGods,
            shensha: chartV2.shensha,
            yongShen: chartV2.yongShen,
            luckPillars: chartV2.luckPillars,
            liunian: chartV2.liunian,
            currentLuck: chartV2.luckPillars[0]
              ? `${chartV2.luckPillars[0].gan}${chartV2.luckPillars[0].zhi}`
              : "",
          },
          aiText,
        };

        const [card] = await db
          .insert(messages)
          .values({
            conversation_id: data.conversationId,
            role: "assistant",
            content: aiText || "(AI 解读未生成)",
            intent: "bazi",
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
          .set({ last_intent: "bazi", last_message_at: new Date().toISOString() })
          .where(eq(conversations.id, data.conversationId));

        safeEnqueue(controller, frame("done", {}));
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("/api/divination/bazi 失败", e);
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
 * 解析 quick_form 的 birth_time 字符串
 * 支持 "1995-03-22 09:00" / "1995-03-22 09:00:00" / "1995/03/22 09:00"
 */
function splitDateTime(raw: string): { dateOnly: string; timeOnly: string } {
  const normalized = raw.replace(/\//g, "-").trim();
  const parts = normalized.split(/\s+/);
  const dateOnly = parts[0] ?? "1990-01-01";
  const timeOnly = (parts[1] ?? "12:00").slice(0, 5); // HH:MM
  return { dateOnly, timeOnly };
}

/**
 * 把 profile 里的 birth_date / birth_time 文本拼成一个带 +08:00 偏移的 Date。
 * 之所以显式带 UTC+8：buildChartV2 内部用真太阳时校正，依赖准确的 UTC 表示。
 */
function parseBirthDateTime(date: string, time: string): Date {
  const t = time.length >= 5 ? time.slice(0, 5) : "12:00";
  const iso = `${date}T${t}:00+08:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date("1990-01-01T12:00:00+08:00");
  }
  return d;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
