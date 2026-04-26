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
import { castByNumbers, castByTime } from "@/lib/meihua/cast";
import { interpretMeihua, type MeihuaResult } from "@/lib/meihua/interpret";
import { loadPrompt, renderTemplate } from "@/lib/ai/prompts";
import { chat } from "@/lib/ai/client";

/**
 * POST /api/divination/meihua — 起卦 + 推演（不调 AI，AI 解读由 PATCH/独立请求触发）
 * PATCH /api/divination/meihua — 外应回填 + 重新解读（spec §6.2 外应分支）
 */
export const runtime = "nodejs";

const VERDICT_BY_RELATION: Record<MeihuaResult["tiYong"]["relation"], string> = {
  ti_ke_yong: "体克用 · 吉",
  yong_ke_ti: "用克体 · 需留神",
  ti_sheng_yong: "体生用 · 略耗心力",
  yong_sheng_ti: "用生体 · 大吉",
  bi_he: "比和 · 平顺",
};

const postSchema = z
  .object({
    conversationId: z.string().min(1).optional(),
    method: z.enum(["time", "number"]),
    numbers: z.array(z.number().int().positive()).max(3).optional(),
    userQuestion: z.string().trim().min(1).max(500),
  })
  .refine(
    (v) =>
      v.method === "time" || (v.numbers !== undefined && v.numbers.length >= 1),
    { message: "数字起卦需提供 1-3 个正整数", path: ["numbers"] },
  );

const patchSchema = z.object({
  messageId: z.string().min(1),
  waiying: z.string().trim().min(1).max(200),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { conversationId: incomingConvId, method, numbers, userQuestion } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  // 1. 起卦 + 推演
  let cast;
  try {
    cast =
      method === "time"
        ? castByTime()
        : castByNumbers(...(numbers ?? []));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "起卦失败" },
      { status: 400 },
    );
  }
  const result = interpretMeihua(cast);

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
      .values({ user_id: userId, title: `梅花 · ${result.ben.name}` })
      .returning({ id: conversations.id });
    if (!created) {
      return NextResponse.json({ error: "会话创建失败" }, { status: 500 });
    }
    conversationId = created.id;
  }

  // 3. 落 user message
  const [userMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "user",
      content: `[梅花 · ${method === "time" ? "时间起卦" : "数字起卦"}] ${userQuestion}`,
      intent: "meihua",
    })
    .returning();
  if (!userMsg) {
    return NextResponse.json({ error: "用户消息写入失败" }, { status: 500 });
  }

  // 4. 落 assistant message（卦象卡）— metadata 内嵌全量推演结果
  const [insertedMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: `起到一卦：${result.ben.name}，动爻第 ${result.dongYao} 爻 → ${result.bian.name}`,
      intent: "meihua",
      metadata: serializeJson({
        ui: "meihua_result",
        ben: result.ben,
        hu: result.hu,
        bian: result.bian,
        guaZhongGua: result.guaZhongGua,
        dongYao: result.dongYao,
        tiYong: result.tiYong,
        yingQi: result.yingQi,
        verdict: VERDICT_BY_RELATION[result.tiYong.relation],
        method: result.method,
      }),
    })
    .returning();
  if (!insertedMsg) {
    return NextResponse.json({ error: "卦象消息写入失败" }, { status: 500 });
  }

  // 5. 落 divination_records
  await db.insert(divinationRecords).values({
    message_id: insertedMsg.id,
    type: "meihua",
    input: serializeJson({ method, numbers: numbers ?? null, userQuestion, waiying: null }),
    result: serializeJson(result),
  });

  // 6. 调 AI 解读（meihua.interpret）— 非流式，落到第三条消息
  let aiText: string | null = null;
  try {
    const prompt = await loadPrompt("meihua.interpret");

    const benRow = await db
      .select({ judgment: hexagrams.judgment })
      .from(hexagrams)
      .where(eq(hexagrams.number, result.ben.number))
      .limit(1);

    const userText = renderTemplate(prompt.userPromptTpl, {
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
      verdict: VERDICT_BY_RELATION[result.tiYong.relation],
      speed: result.yingQi.speed,
      timeHint: result.yingQi.timeHint,
      branchHour: result.yingQi.branchHour ?? "（数字起卦无）",
      userQuestion,
      waiying: "（用户尚未提供）",
    });

    const ai = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: userText }],
      stream: false,
      meta: { conversationId, userId },
    });

    const [aiMsg] = await db
      .insert(messages)
      .values({
        conversation_id: conversationId,
        role: "assistant",
        content: ai.text,
        intent: "meihua",
        tokens_used: ai.tokensUsed,
        metadata: serializeJson({ ui: "meihua_reading", waiying: null }),
      })
      .returning();
    if (aiMsg) aiText = ai.text;

    if (aiMsg) {
      await db
        .update(divinationRecords)
        .set({ ai_reading: ai.text })
        .where(eq(divinationRecords.message_id, insertedMsg.id));
    }
  } catch (e) {
    console.error("meihua AI 解读失败（继续返回卦象卡）", e);
  }

  // 7. 更新会话时间
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
    aiReading: aiText,
  });
}

/**
 * PATCH — 外应回填 + 二次解读
 *
 * body: { messageId（meihua_result 卦象卡的 messageId）, waiying }
 *
 * 行为：
 *   1. 找到对应的 divination_records
 *   2. 把 input.waiying 写回
 *   3. 重新调 meihua.interpret prompt（waiying 现在有值）
 *   4. 落新的 assistant message（外应融合解读）
 *   5. 返回新 message
 */
export async function PATCH(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { messageId, waiying } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  // 1. 找 message + 校验归属（通过 conversation owner）
  const msgRow = await db
    .select({
      messageId: messages.id,
      conversationId: messages.conversation_id,
      metadata: messages.metadata,
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

  // 2. 找 divination_records
  const recordRow = await db
    .select()
    .from(divinationRecords)
    .where(eq(divinationRecords.message_id, messageId))
    .limit(1);
  const record = recordRow[0];
  if (!record || record.type !== "meihua") {
    return NextResponse.json({ error: "找不到对应的梅花记录" }, { status: 404 });
  }

  // 3. 回填 waiying
  const oldInput = parseJson<{ method: string; numbers: number[] | null; userQuestion: string; waiying: string | null }>(record.input, {
    method: "time",
    numbers: null,
    userQuestion: "",
    waiying: null,
  });
  const newInput = { ...oldInput, waiying };
  await db
    .update(divinationRecords)
    .set({ input: serializeJson(newInput) })
    .where(eq(divinationRecords.id, record.id));

  // 4. 重新解读 — 取出原 result 用作 prompt 输入
  const result = parseJson<MeihuaResult>(record.result, null as unknown as MeihuaResult);
  if (!result) {
    return NextResponse.json({ error: "原卦象数据损坏" }, { status: 500 });
  }

  let prompt;
  try {
    prompt = await loadPrompt("meihua.interpret");
  } catch (e) {
    return NextResponse.json(
      { error: `meihua.interpret prompt 未种入: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const benRow = await db
    .select({ judgment: hexagrams.judgment })
    .from(hexagrams)
    .where(eq(hexagrams.number, result.ben.number))
    .limit(1);

  const userText = renderTemplate(prompt.userPromptTpl, {
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
    verdict: VERDICT_BY_RELATION[result.tiYong.relation],
    speed: result.yingQi.speed,
    timeHint: result.yingQi.timeHint,
    branchHour: result.yingQi.branchHour ?? "（数字起卦无）",
    userQuestion: oldInput.userQuestion,
    waiying,
  });

  const ai = await chat({
    systemPrompt: prompt.systemPrompt,
    messages: [{ role: "user", content: userText }],
    stream: false,
    meta: { conversationId: m.conversationId, userId },
  });

  const [aiMsg] = await db
    .insert(messages)
    .values({
      conversation_id: m.conversationId,
      role: "assistant",
      content: ai.text,
      intent: "meihua",
      tokens_used: ai.tokensUsed,
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

// 简单 wuxing 反查（梅花用 8 卦五行）
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
