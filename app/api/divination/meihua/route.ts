import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  conversations,
  divinationRecords,
  hexagrams,
  messages,
} from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { parseJson, serializeJson } from "@/lib/db/json";
import { castByNumbers } from "@/lib/meihua/cast";
import { interpretMeihua, type MeihuaResult } from "@/lib/meihua/interpret";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { chat } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { guardTexts } from "@/lib/safety/guard";

/**
 * POST /api/divination/meihua — 简化为纯数字测算
 *
 * 请求 body：{ conversationId, numbers([1-3 个 1-9 整数]), userQuestion }
 *
 * 工作流：
 *   1. castByNumbers(numbers) → interpretMeihua → 完整推演
 *   2. 写 user message（[测算 · 数字 X、Y、Z] {userQuestion}）
 *   3. 调 AI 解读 → assistant message metadata.ui='meihua_result'（含 ben/hu/bian/guaZhongGua/dongYao/tiYong/yingQi/verdict）
 *   4. 写 divination_records (type='meihua') + 更新 last_message_at
 *
 * PATCH /api/divination/meihua — 外应回填 + 二次解读（保留原有实现）
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const VERDICT_BY_RELATION: Record<MeihuaResult["tiYong"]["relation"], string> = {
  yong_sheng_ti: "用生体 · 大吉",
  ti_ke_yong: "体克用 · 吉",
  bi_he: "比和 · 平顺",
  ti_sheng_yong: "体生用 · 略耗心力",
  yong_ke_ti: "用克体 · 留神",
};

const postSchema = z.object({
  conversationId: z.string().min(1),
  numbers: z.array(z.number().int().min(1).max(9)).min(1).max(3),
  userQuestion: z.string().trim().min(1).max(500),
});

const patchSchema = z.object({
  messageId: z.string().min(1),
  waiying: z.string().trim().min(1).max(200),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { conversationId, numbers, userQuestion } = parsed.data;

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

  let cast;
  try {
    cast = castByNumbers(...numbers);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "起卦失败", 400);
  }
  const result = interpretMeihua(cast);

  const [userMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "user",
      content: `[测算 · 数字 ${numbers.join("、")}] ${userQuestion}`,
      intent: "meihua",
    })
    .returning();
  if (!userMsg) return jsonError("用户消息写入失败", 500);

  let aiText = "（解读暂时不可用，请稍后再试）";
  let tokens = 0;
  try {
    const prompt = await loadPrompt("meihua.interpret");
    const benRow = await db
      .select({ judgment: hexagrams.judgment })
      .from(hexagrams)
      .where(eq(hexagrams.number, result.ben.number))
      .limit(1);
    const tpl = renderTemplate(prompt.userPromptTpl, {
      benName: result.ben.name,
      upperWuxing: wuxingOf(result.ben.upper),
      lowerWuxing: wuxingOf(result.ben.lower),
      benJudgment: benRow[0]?.judgment ?? "（卦辞待补）",
      dongYao: result.dongYao,
      huName: result.hu.name,
      bianName: result.bian.name,
      guaZhongName: result.guaZhongGua.name,
      ti: result.tiYong.ti,
      yong: result.tiYong.yong,
      tiWuxing: wuxingOf(result.tiYong.ti),
      yongWuxing: wuxingOf(result.tiYong.yong),
      relation: result.tiYong.relation,
      verdict: VERDICT_BY_RELATION[result.tiYong.relation] ?? "",
      speed: result.yingQi.speed,
      timeHint: result.yingQi.timeHint,
      branchHour: result.yingQi.branchHour ?? "（数字起卦无）",
      userQuestion,
      waiying: "（用户尚未提供）",
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: tpl }],
      stream: false,
      meta: { conversationId, userId },
    });
    aiText = ai.text;
    tokens = ai.tokensUsed;
  } catch (e) {
    console.error("meihua AI 解读失败", e);
  }

  const [resultMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: aiText,
      intent: "meihua",
      tokens_used: tokens,
      metadata: serializeJson({
        ui: "meihua_result",
        ben: result.ben,
        hu: result.hu,
        bian: result.bian,
        guaZhongGua: result.guaZhongGua,
        dongYao: result.dongYao,
        tiYong: result.tiYong,
        yingQi: result.yingQi,
        verdict: VERDICT_BY_RELATION[result.tiYong.relation] ?? "",
      }),
    })
    .returning();
  if (!resultMsg) return jsonError("解读消息写入失败", 500);

  await db.insert(divinationRecords).values({
    message_id: resultMsg.id,
    type: "meihua",
    input: serializeJson({ numbers, userQuestion, waiying: null }),
    result: serializeJson(result),
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

/**
 * PATCH — 外应回填 + 二次解读（保留原有逻辑）
 */
export async function PATCH(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { messageId, waiying } = parsed.data;

  const safetyFail = guardTexts({ waiying });
  if (safetyFail) return safetyFail;

  const userId = await ensureUserId();
  const db = getDb();

  const msgRow = await db
    .select({
      messageId: messages.id,
      conversationId: messages.conversation_id,
      ownerId: conversations.user_id,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversation_id))
    .where(eq(messages.id, messageId))
    .limit(1);
  const m = msgRow[0];
  if (!m || m.ownerId !== userId) {
    return NextResponse.json({ error: "消息不存在或无权操作" }, { status: 404 });
  }

  const recordRow = await db
    .select()
    .from(divinationRecords)
    .where(eq(divinationRecords.message_id, messageId))
    .limit(1);
  const record = recordRow[0];
  if (!record || record.type !== "meihua") {
    return NextResponse.json({ error: "找不到对应的梅花记录" }, { status: 404 });
  }

  const oldInput = parseJson<{
    numbers: number[];
    userQuestion: string;
    waiying: string | null;
  }>(record.input, { numbers: [], userQuestion: "", waiying: null });
  await db
    .update(divinationRecords)
    .set({ input: serializeJson({ ...oldInput, waiying }) })
    .where(eq(divinationRecords.id, record.id));

  const result = parseJson<MeihuaResult>(record.result, null as unknown as MeihuaResult);
  if (!result) {
    return NextResponse.json({ error: "原卦象数据损坏" }, { status: 500 });
  }

  let aiText = "（外应解读暂时不可用，请稍后再试）";
  let tokens = 0;
  try {
    const prompt = await loadPrompt("meihua.interpret");
    const benRow = await db
      .select({ judgment: hexagrams.judgment })
      .from(hexagrams)
      .where(eq(hexagrams.number, result.ben.number))
      .limit(1);

    const tpl = renderTemplate(prompt.userPromptTpl, {
      benName: result.ben.name,
      upperWuxing: wuxingOf(result.ben.upper),
      lowerWuxing: wuxingOf(result.ben.lower),
      benJudgment: benRow[0]?.judgment ?? "（卦辞待补）",
      dongYao: result.dongYao,
      huName: result.hu.name,
      bianName: result.bian.name,
      guaZhongName: result.guaZhongGua.name,
      ti: result.tiYong.ti,
      yong: result.tiYong.yong,
      tiWuxing: wuxingOf(result.tiYong.ti),
      yongWuxing: wuxingOf(result.tiYong.yong),
      relation: result.tiYong.relation,
      verdict: VERDICT_BY_RELATION[result.tiYong.relation] ?? "",
      speed: result.yingQi.speed,
      timeHint: result.yingQi.timeHint,
      branchHour: result.yingQi.branchHour ?? "（数字起卦无）",
      userQuestion: oldInput.userQuestion,
      waiying,
    });
    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: tpl }],
      stream: false,
      meta: { conversationId: m.conversationId, userId },
    });
    aiText = ai.text;
    tokens = ai.tokensUsed;
  } catch (e) {
    console.error("meihua PATCH AI 解读失败", e);
  }

  const [aiMsg] = await db
    .insert(messages)
    .values({
      conversation_id: m.conversationId,
      role: "assistant",
      content: aiText,
      intent: "meihua",
      tokens_used: tokens,
      metadata: serializeJson({ ui: "meihua_reading", waiying }),
    })
    .returning();

  await db
    .update(conversations)
    .set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, m.conversationId));

  return NextResponse.json({
    assistantMessage: aiMsg && {
      id: aiMsg.id,
      role: "assistant" as const,
      content: aiMsg.content,
      created_at: aiMsg.created_at,
      metadata: aiMsg.metadata,
    },
  });
}

function wuxingOf(trigram: string): string {
  const map: Record<string, string> = {
    乾: "金",
    兑: "金",
    离: "火",
    震: "木",
    巽: "木",
    坎: "水",
    艮: "土",
    坤: "土",
  };
  return map[trigram] ?? "?";
}

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}
