import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  conversations,
  divinationRecords,
  divinationSlips,
  messages,
} from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { pickSlip } from "@/lib/divination/slips";
import { parseJson, serializeJson } from "@/lib/db/json";

/**
 * POST /api/divination/qianwen — 抽签 + 落库
 *
 * 流程：
 *   1. 校验 body { conversationId, dimension, userQuestion }
 *   2. ensureUserId + 校验 conversation 归属
 *   3. pickSlip(seed = userId-Date.now()) → number 1-30
 *   4. select divination_slips.* by number
 *   5. insert messages (role=assistant, intent=divination, metadata={ ui:'slip_result', slipNumber, dimension })
 *   6. insert divination_records (type=qianwen, input={ dimension, userQuestion }, result={ slip + 该维度 reading })
 *   7. 返回 { messageId, slip, reading }
 *
 * AI 解读由前端拿到 slip 后调 /api/chat 流式拉（user 提示文本带 prompt 模板渲染结果）
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  dimension: z.enum(["综合", "事业", "财运", "感情", "人际", "健康"]),
  userQuestion: z.string().min(1).max(500),
});

interface SlipReadings {
  综合?: string;
  事业?: string;
  财运?: string;
  感情?: string;
  人际?: string;
  健康?: string;
}

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
  const { conversationId, dimension, userQuestion } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  // 校验会话归属
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  // 抽签
  const { number } = pickSlip({ seed: `${userId}-${Date.now()}` });

  const slipRow = await db
    .select()
    .from(divinationSlips)
    .where(eq(divinationSlips.number, number))
    .limit(1);
  const slip = slipRow[0];
  if (!slip) {
    return NextResponse.json(
      { error: `灵签 #${number} 未找到 (seed 是否未灌库?)` },
      { status: 500 },
    );
  }

  const readings = parseJson<SlipReadings>(slip.readings, {});
  const reading =
    readings[dimension] ?? readings["综合"] ?? "（暂无该维度解读，看综合即可）";

  // 落 assistant message + divination_records
  const [insertedMsg] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      role: "assistant",
      content: `抽到第 ${slip.number} 签 · ${slip.level} · ${slip.title}`,
      intent: "divination",
      metadata: serializeJson({
        ui: "slip_result",
        slipNumber: slip.number,
        dimension,
      }),
    })
    .returning();

  if (!insertedMsg) {
    return NextResponse.json({ error: "消息写入失败" }, { status: 500 });
  }

  await db.insert(divinationRecords).values({
    message_id: insertedMsg.id,
    type: "qianwen",
    input: serializeJson({ dimension, userQuestion }),
    result: serializeJson({
      number: slip.number,
      level: slip.level,
      title: slip.title,
      poem: slip.poem,
      reading,
    }),
  });

  // 更新会话 last_message_at
  await db
    .update(conversations)
    .set({ last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({
    messageId: insertedMsg.id,
    slip: {
      number: slip.number,
      level: slip.level,
      title: slip.title,
      poem: slip.poem,
      readings,
    },
    reading,
  });
}
