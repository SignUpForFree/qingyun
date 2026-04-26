import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  baziCharts,
  conversations,
  divinationRecords,
  messages,
  profiles,
} from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { parseJson, serializeJson } from "@/lib/db/json";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { chat } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";
import { buildChart } from "@/lib/bazi/chart";
import type { BaziComputed, BaziPillars, BaziTenGods, LuckPillar } from "@/types/domain";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * POST /api/divination/bazi — 八字 sub-action（profileSnapshot 支持）
 *
 * 请求 body：
 *   { conversationId, focus(新 6 类), userQuestion, profileSnapshot? }
 *
 * profileSnapshot：在 chat 内填表用，无需先建档
 *   { gender, birth_time, calendar_type?, birth_province, birth_city, birth_district?, longitude, latitude }
 *
 * 工作流：
 *   1. 校验 + 限流 + 安全词
 *   2. 校验会话归属
 *   3. 若有 profileSnapshot → buildChart 当场算
 *      若无 → 拉默认 profile + bazi_charts，无则返回 412 NO_PROFILE
 *   4. 写 user message + assistant message(metadata.ui='bazi_result' + chart 元信息)
 *   5. 写 divination_records + 更新 last_message_at
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const FOCUS = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

const profileSnapshotSchema = z.object({
  gender: z.enum(["male", "female"]),
  birth_time: z.string().min(1),
  calendar_type: z.enum(["solar", "lunar"]).default("solar"),
  birth_province: z.string().min(1),
  birth_city: z.string().min(1),
  birth_district: z.string().nullish(),
  longitude: z.number(),
  latitude: z.number(),
});

const bodySchema = z.object({
  conversationId: z.string().min(1),
  focus: z.enum(FOCUS),
  userQuestion: z.string().trim().min(1).max(500),
  profileSnapshot: profileSnapshotSchema.nullish(),
});

type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>;

interface ChartViewModel {
  pillars: BaziPillars;
  fiveElements: Record<Wuxing, number>;
  dayMaster: string;
  tenGods: BaziTenGods;
  luckPillars: LuckPillar[];
  currentLuck: string;
  birthLocation: string;
  birthTime: string;
  calendarType: "solar" | "lunar";
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
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { conversationId, focus, userQuestion, profileSnapshot } = parsed.data;

  const safetyFail = guardTexts({ userQuestion });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const rate = await checkRateLimit(userId);
  if (!rate.allowed) {
    return jsonError(
      `每小时上限 ${rate.limit} 条，请稍后再试（已用 ${rate.used}）`,
      429,
    );
  }

  const db = getDb();

  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)),
    )
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);

  let chartView: ChartViewModel;
  try {
    chartView = profileSnapshot
      ? computeFromSnapshot(profileSnapshot)
      : await loadFromDefaultProfile(userId);
  } catch (e) {
    if (e instanceof BaziError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    console.error("bazi chart 加载失败", e);
    return jsonError("命盘加载失败", 500);
  }

  const [userMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "user",
      content: `[八字 · ${focus}] ${userQuestion}`,
      intent: "bazi",
    })
    .returning();
  if (!userMsg) return jsonError("用户消息写入失败", 500);

  let aiText = "（解读暂时不可用，请稍后再试）";
  let tokens = 0;
  try {
    const prompt = await loadPrompt("bazi.interpret");
    const userText = renderTemplate(prompt.userPromptTpl, {
      birthTime: chartView.birthTime,
      calendarType: chartView.calendarType,
      birthLocation: chartView.birthLocation,
      pillars: formatPillars(chartView.pillars),
      dayMaster: chartView.dayMaster,
      fiveElements: formatFiveElements(chartView.fiveElements),
      tenGods: formatTenGods(chartView.tenGods),
      currentLuck: chartView.currentLuck,
      focus,
      userQuestion,
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: userText }],
      stream: false,
      meta: { conversationId, userId },
    });
    aiText = ai.text;
    tokens = ai.tokensUsed;
  } catch (e) {
    console.error("bazi AI 解读失败", e);
  }

  const [resultMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: aiText,
      intent: "bazi",
      tokens_used: tokens,
      metadata: serializeJson({
        ui: "bazi_result",
        focus,
        chart: {
          pillars: chartView.pillars,
          fiveElements: chartView.fiveElements,
          dayMaster: chartView.dayMaster,
          tenGods: chartView.tenGods,
          currentLuck: chartView.currentLuck,
        },
      }),
    })
    .returning();
  if (!resultMsg) return jsonError("解读消息写入失败", 500);

  await db.insert(divinationRecords).values({
    message_id: resultMsg.id,
    type: "bazi",
    input: serializeJson({ focus, userQuestion, snapshot: profileSnapshot ?? null }),
    result: serializeJson({
      pillars: chartView.pillars,
      fiveElements: chartView.fiveElements,
      tenGods: chartView.tenGods,
      currentLuck: chartView.currentLuck,
      reading: aiText,
      tokensUsed: tokens,
    }),
    ai_reading: aiText,
  });

  await db
    .update(conversations)
    .set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({
    conversationId,
    userMessage: {
      id: userMsg.id,
      role: "user" as const,
      content: userMsg.content,
      created_at: userMsg.created_at,
    },
    resultMessage: {
      id: resultMsg.id,
      role: "assistant" as const,
      content: resultMsg.content,
      created_at: resultMsg.created_at,
      metadata: resultMsg.metadata,
    },
  });
}

class BaziError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
  }
}

function computeFromSnapshot(s: ProfileSnapshot): ChartViewModel {
  const birthDate = new Date(s.birth_time);
  if (Number.isNaN(birthDate.getTime())) {
    throw new BaziError("BAD_BIRTH_TIME", "出生时间不合法", 400);
  }
  const computed: BaziComputed = buildChart({
    birthTime: birthDate,
    longitude: s.longitude,
    latitude: s.latitude,
    gender: s.gender,
    calendarType: s.calendar_type,
  });
  const birthLocation = [s.birth_province, s.birth_city, s.birth_district]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(" ");
  return {
    pillars: computed.pillars,
    fiveElements: computed.fiveElements,
    dayMaster: computed.dayMaster,
    tenGods: computed.tenGods,
    luckPillars: computed.luckPillars,
    currentLuck: pickCurrentLuck(computed.luckPillars, s.birth_time),
    birthLocation: birthLocation || "未知",
    birthTime: s.birth_time,
    calendarType: s.calendar_type,
  };
}

async function loadFromDefaultProfile(userId: string): Promise<ChartViewModel> {
  const db = getDb();
  const profileRow = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.user_id, userId), eq(profiles.is_default, true)))
    .limit(1);
  const profile = profileRow[0];
  if (!profile) {
    throw new BaziError("NO_PROFILE", "请先在档案页填写八字信息", 412);
  }

  const chartRow = await db
    .select()
    .from(baziCharts)
    .where(eq(baziCharts.profile_id, profile.id))
    .limit(1);
  const chart = chartRow[0];
  if (!chart) {
    throw new BaziError("NO_CHART", "档案存在但命盘未排，请重新建档", 500);
  }

  const pillars = parseJson<BaziPillars>(chart.pillars, {} as BaziPillars);
  const fiveElements = parseJson<Record<Wuxing, number>>(
    chart.five_elements,
    {} as Record<Wuxing, number>,
  );
  const tenGods = parseJson<BaziTenGods>(chart.ten_gods, {} as BaziTenGods);
  const luckPillars = parseJson<LuckPillar[]>(chart.luck_pillars ?? "[]", []);
  const birthLocation = [profile.birth_province, profile.birth_city, profile.birth_district]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(" ");

  return {
    pillars,
    fiveElements,
    dayMaster: chart.day_master,
    tenGods,
    luckPillars,
    currentLuck: pickCurrentLuck(luckPillars, profile.birth_time),
    birthLocation: birthLocation || "未知",
    birthTime: profile.birth_time ?? "未知",
    calendarType: profile.calendar_type ?? "solar",
  };
}

function formatPillars(p: BaziPillars): string {
  if (!p?.year) return "（未排盘）";
  return [
    `年柱 ${p.year.gan}${p.year.zhi}`,
    `月柱 ${p.month.gan}${p.month.zhi}`,
    `日柱 ${p.day.gan}${p.day.zhi}`,
    `时柱 ${p.hour.gan}${p.hour.zhi}`,
  ].join("，");
}

function formatFiveElements(fe: Record<Wuxing, number>): string {
  const order: Wuxing[] = ["金", "木", "水", "火", "土"];
  return order.map((w) => `${w} ${fe[w] ?? 0}`).join("，");
}

function formatTenGods(t: BaziTenGods): string {
  if (!t?.year) return "（未判定）";
  return `年 ${t.year}，月 ${t.month}，时 ${t.hour}`;
}

function pickCurrentLuck(luck: LuckPillar[], birthTimeIso: string | null): string {
  if (!birthTimeIso || luck.length === 0) return "（未起大运）";
  const birth = new Date(birthTimeIso);
  if (Number.isNaN(birth.getTime())) return "（未起大运）";
  const ageNow = Math.max(
    0,
    Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
  );
  const sorted = [...luck].sort((a, b) => a.age - b.age);
  let current = sorted[0];
  for (const lp of sorted) {
    if (lp.age <= ageNow) current = lp;
    else break;
  }
  return current ? `${current.gan}${current.zhi}（约 ${current.age} 岁起步）` : "（未起大运）";
}

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
