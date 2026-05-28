import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages, profiles } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { guardTexts } from "@/lib/safety/guard";
import { chat } from "@/lib/ai/client";
import { frame, heartbeat, safeEnqueue, SSE_HEADERS } from "@/lib/chat/sse";
import { serializeJson } from "@/lib/db/json";
import { baziProvider } from "@/lib/divination-providers";
import { findCity } from "@/lib/regions/data";
import { buildBaziPrompt, type V2DivinationDim } from "@/lib/ai/prompts/bazi-interpret";
import { buildBaziResultCardMeta } from "@/lib/bazi/card-meta";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { parsePillarsCache, serializePillars } from "@/lib/profile/bazi-pillars";
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
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

/** 从 birth_place 文本（如"广东省 深圳市 南山区"）解析经纬度 */
function resolveBirthPlaceCoords(birthPlace: string): { longitude: number; latitude: number } {
  if (!birthPlace || birthPlace === "未填") {
    return { longitude: 121.47, latitude: 31.23 }; // 上海兜底
  }
  const parts = birthPlace.replace(/\s+/g, " ").trim().split(" ");
  const provinceRaw = parts[0] ?? "";
  const cityRaw = parts[1] ?? provinceRaw;
  // 去"省/市/自治区"等后缀
  const province = provinceRaw.replace(/壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市$/u, "").trim();
  const city = cityRaw.replace(/市$/u, "").trim();
  const row = findCity(province, city || province);
  if (row) {
    const { lng, lat } = row;
    // §1.1.1: 经纬度取值范围校验，超出则忽略
    if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      return { longitude: lng, latitude: lat };
    }
  }
  return { longitude: 121.47, latitude: 31.23 }; // 兜底
}

const quickFormSchema = z.object({
  gender: z.enum(["male", "female"]),
  birth_time: z.string().min(1).max(50),
  birth_place: z.string().min(1).max(60),
});

// CLAUDE.md 第 1 条踩坑：ChatWindow 首次会话 convId 为 null，必须 .nullish()
// 否则 zod 直接 400 "expected string, received null"，全部按钮卡报错。
const bodySchema = z.object({
  conversationId: z.string().min(1).nullish(),
  profileId: z.string().min(1).optional(),
  focus: z.enum(VALID_CATEGORIES).optional(),
  quickFormData: quickFormSchema.optional(),
});

export async function POST(req: Request) {
  const body = await parseJsonBody(req, bodySchema);
  if (body.error) return body.error;
  const data = body.data;
  const conversationId = data.conversationId;
  if (!conversationId) {
    return jsonError("conversationId 必填（请先发起一条文本消息再使用八字按钮）", 400);
  }

  const userId = await ensureUserId();
  const limited = await enforceRateLimit(userId, "bazi", "八字 AI 解读");
  if (limited) return limited;

  const db = getDb();
  const ownedFail = await requireConversationOwned(db, conversationId, userId);
  if (ownedFail) return ownedFail;

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
        conversation_id: conversationId,
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
          conversation_id: conversationId,
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

    // 单档案 fast-path：直接进 focus_picker，不弹档案选择
    if (userProfiles.length === 1) {
      const onlyId = userProfiles[0]!.id;
      const cardMeta = {
        ui: "bazi_focus_picker" as const,
        profileId: onlyId,
        options: VALID_CATEGORIES.map((k) => ({ key: k, label: k })),
      };
      const [card] = await db
        .insert(messages)
        .values({
          conversation_id: conversationId,
          role: "assistant",
          content: "您想从哪个角度看八字？",
          intent: "bazi",
          metadata: serializeJson(cardMeta),
        })
        .returning();
      return Response.json({
        step: "focus_picker",
        profileId: onlyId,
        card: {
          id: card?.id,
          role: "assistant",
          content: "您想从哪个角度看八字？",
          metadata: serializeJson(cardMeta),
        },
      });
    }

    const cardMeta = {
      ui: "profile_picker" as const,
      intent: "bazi" as const,
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
        conversation_id: conversationId,
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

  // 客户端断流（关页面 / 刷新 / 切路由）→ ac.abort，再透到 chat() 内部 AbortController，
  // 立刻取消上游 DeepSeek 请求。八字 reasoning enabled 是高 token 路径，最贵；
  // 不接 abort 的话用户关页 AI 还在跑 30s+，烧钱。详见 launch-readiness §1.7。
  const ac = new AbortController();

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
        // 通过 BaziProvider 抽象层，后续可切第三方 API（env BAZI_PROVIDER=api）
        const chartV2 = await baziProvider.buildChart(
          {
            birthTime: parseBirthDateTime(profile.birth_date, profile.birth_time),
            ...resolveBirthPlaceCoords(profile.birth_place),
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

        const shellMeta = buildBaziResultCardMeta({
          profileId,
          focus,
          chartV2,
          aiText: "",
        });

        let cardMessageId: string | undefined;
        try {
          const [shellRow] = await db
            .insert(messages)
            .values({
              conversation_id: conversationId,
              role: "assistant",
              content: "",
              intent: "bazi",
              metadata: serializeJson(shellMeta),
              profile_id_used: profileId,
            })
            .returning();
          cardMessageId = shellRow?.id;
        } catch (insertErr) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[bazi] shell card insert failed", insertErr);
          }
        }

        if (cardMessageId) {
          safeEnqueue(
            controller,
            frame("card", {
              id: cardMessageId,
              role: "assistant",
              content: "",
              metadata: serializeJson(shellMeta),
            }),
          );
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

        // 八字解读涉及命盘 / 神煞 / 大运 / 流年多维度交叉推理，开 reasoning
        // 让 v4 Pro 内部思考一遍再输出，质量明显高于 disabled。
        const stream = await chat({
          systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          stream: true,
          thinking: "enabled",
          meta: { conversationId: conversationId, userId },
          abortSignal: ac.signal,
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
        const finalText = sanitized.cleaned || aiText || "(AI 解读未生成)";
        if (sanitized.hitCount > 0 && process.env.NODE_ENV !== "production") {
          console.warn(
            `[bazi] sanitizer hit ${sanitized.hitCount} forbidden words:`,
            sanitized.hitWords,
          );
        }

        const cardMeta = buildBaziResultCardMeta({
          profileId,
          focus,
          chartV2,
          aiText: finalText,
        });

        if (cardMessageId) {
          await db
            .update(messages)
            .set({
              content: finalText,
              metadata: serializeJson(cardMeta),
              tokens_used: tokens,
            })
            .where(eq(messages.id, cardMessageId));
        } else {
          const [card] = await db
            .insert(messages)
            .values({
              conversation_id: conversationId,
              role: "assistant",
              content: finalText,
              intent: "bazi",
              metadata: serializeJson(cardMeta),
              tokens_used: tokens,
              profile_id_used: profileId,
            })
            .returning();
          cardMessageId = card?.id;
        }

        safeEnqueue(
          controller,
          frame("card", {
            id: cardMessageId,
            role: "assistant",
            content: finalText,
            metadata: serializeJson(cardMeta),
          }),
        );

        await bumpConversationActivity(db, conversationId, "bazi");

        safeEnqueue(controller, frame("done", {}));
      } catch (e) {
        // 客户端 abort 时 chat() 抛 AbortError，不算"AI 卡了"
        if ((e as Error)?.name === "AbortError") {
          if (process.env.NODE_ENV !== "production") {
            console.info("/api/divination/bazi client aborted");
          }
        } else {
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
        }
      } finally {
        stopHeartbeat();
        try {
          controller.close();
        } catch {
          /* 已 close 不致命 */
        }
      }
    },
    cancel() {
      // 客户端断开 / 刷页 / 切路由 → 立即 abort 上游 DeepSeek
      ac.abort(new DOMException("Client disconnected", "AbortError"));
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
  // 保留秒级精度：HH:MM:SS 或 HH:MM
  let timeOnly = parts[1] ?? "12:00";
  if (/^\d{1,2}:\d{2}$/.test(timeOnly)) timeOnly += ":00";
  else if (!/^\d{1,2}:\d{2}:\d{2}$/.test(timeOnly)) timeOnly = "12:00:00";
  return { dateOnly, timeOnly };
}

/**
 * 把 profile 里的 birth_date / birth_time 文本拼成一个带 +08:00 偏移的 Date。
 * 之所以显式带 UTC+8：buildChartV2 内部用真太阳时校正，依赖准确的 UTC 表示。
 */
function parseBirthDateTime(date: string, time: string): Date {
  const t = time.length >= 8 ? time.slice(0, 8) : (time.length >= 5 ? time.slice(0, 5) + ":00" : "12:00:00");
  const iso = `${date}T${t}+08:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date("1990-01-01T12:00:00+08:00");
  }
  // §1.1.1: 出生时间需在 1900-01-01 至当前时间范围内
  const minDate = new Date("1900-01-01T00:00:00+08:00");
  const now = new Date();
  if (d < minDate || d > now) {
    return new Date("1990-01-01T12:00:00+08:00");
  }
  return d;
}
