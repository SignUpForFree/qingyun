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
import type { BaziPillars, BaziTenGods, LuckPillar } from "@/types/domain";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * POST /api/divination/bazi — 八字解读
 *
 * 流程：
 *   1. 校验 body { focus, userQuestion, conversationId? }
 *   2. ensureUserId → 拉默认 profile + bazi_chart
 *      - 无 profile → 412 (请先建档)
 *      - 无 chart → 500 (建档时排盘失败需重排)
 *   3. 校验 / 自动创建 conversation
 *   4. 落 user message
 *   5. 渲染 bazi.interpret prompt + chat() 生成解读
 *   6. 落 assistant message + divination_records
 *   7. 返回结构化 response
 *
 * V1.0 走非流式（spec §6.4 第 5 条 - V1.0 暂不做 BaziChart 卡片）
 */
export const runtime = "nodejs";

const FOCUS_VALUES = [
  "综合",
  "事业",
  "财运",
  "感情",
  "人际",
  "健康",
] as const;

const bodySchema = z.object({
  conversationId: z.string().min(1).optional(),
  focus: z.enum(FOCUS_VALUES),
  userQuestion: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { conversationId: incomingConvId, focus, userQuestion } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  // 1. 默认档案 + 命盘
  const profileRow = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.user_id, userId), eq(profiles.is_default, true)))
    .limit(1);
  const profile = profileRow[0];
  if (!profile) {
    return NextResponse.json(
      { error: "请先在 /onboarding 建档", code: "NO_PROFILE" },
      { status: 412 },
    );
  }

  const chartRow = await db
    .select()
    .from(baziCharts)
    .where(eq(baziCharts.profile_id, profile.id))
    .limit(1);
  const chart = chartRow[0];
  if (!chart) {
    return NextResponse.json(
      { error: "档案存在但命盘未排，请重新建档", code: "NO_CHART" },
      { status: 500 },
    );
  }

  // 2. 会话
  let conversationId: string;
  if (incomingConvId) {
    const owned = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, incomingConvId), eq(conversations.user_id, userId)))
      .limit(1);
    if (!owned[0]) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    conversationId = incomingConvId;
  } else {
    const [created] = await db
      .insert(conversations)
      .values({ user_id: userId, title: `八字 · ${focus}` })
      .returning({ id: conversations.id });
    if (!created) {
      return NextResponse.json({ error: "会话创建失败" }, { status: 500 });
    }
    conversationId = created.id;
  }

  // 3. 落用户原话
  const [userMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "user",
      content: `[八字 · ${focus}] ${userQuestion}`,
      intent: "bazi",
    })
    .returning();
  if (!userMsg) {
    return NextResponse.json({ error: "用户消息写入失败" }, { status: 500 });
  }

  // 4. 渲染 prompt
  const pillars = parseJson<BaziPillars>(chart.pillars, {} as BaziPillars);
  const fiveElements = parseJson<Record<Wuxing, number>>(
    chart.five_elements,
    {} as Record<Wuxing, number>,
  );
  const tenGods = parseJson<BaziTenGods>(chart.ten_gods, {} as BaziTenGods);
  const luckPillars = parseJson<LuckPillar[]>(chart.luck_pillars ?? "[]", []);
  const currentLuck = pickCurrentLuck(luckPillars, profile.birth_time);

  let prompt;
  try {
    prompt = await loadPrompt("bazi.interpret");
  } catch (e) {
    return NextResponse.json(
      { error: `bazi.interpret prompt 未种入: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const userText = renderTemplate(prompt.userPromptTpl, {
    birthTime: profile.birth_time ?? "未知",
    calendarType: profile.calendar_type ?? "solar",
    birthLocation: formatBirthLocation(profile),
    pillars: formatPillars(pillars),
    dayMaster: chart.day_master,
    fiveElements: formatFiveElements(fiveElements),
    tenGods: formatTenGods(tenGods),
    currentLuck,
    focus,
    userQuestion,
  });

  // 5. AI
  const ai = await chat({
    systemPrompt: prompt.systemPrompt,
    messages: [{ role: "user", content: userText }],
    stream: false,
    meta: { conversationId, userId },
  });

  // 6. 落 assistant + divination_records
  const [insertedMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: ai.text,
      intent: "bazi",
      tokens_used: ai.tokensUsed,
      metadata: serializeJson({ ui: "bazi_result", focus }),
    })
    .returning();
  if (!insertedMsg) {
    return NextResponse.json({ error: "解读消息写入失败" }, { status: 500 });
  }

  await db.insert(divinationRecords).values({
    message_id: insertedMsg.id,
    type: "bazi",
    input: serializeJson({ focus, userQuestion, profileId: profile.id }),
    result: serializeJson({
      pillars,
      fiveElements,
      tenGods,
      currentLuck,
      reading: ai.text,
      tokensUsed: ai.tokensUsed,
    }),
    ai_reading: ai.text,
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
    assistantMessage: {
      id: insertedMsg.id,
      role: "assistant" as const,
      content: insertedMsg.content,
      created_at: insertedMsg.created_at,
      metadata: insertedMsg.metadata,
    },
  });
}

// ---------- 格式化 helpers ----------

function formatBirthLocation(p: typeof profiles.$inferSelect): string {
  const parts = [p.birth_province, p.birth_city, p.birth_district].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  return parts.length ? parts.join(" ") : "未知";
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
  return order
    .map((w) => `${w} ${fe[w] ?? 0}`)
    .join("，");
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
  return current
    ? `${current.gan}${current.zhi}（约 ${current.age} 岁起步）`
    : "（未起大运）";
}
