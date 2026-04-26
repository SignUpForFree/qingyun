import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { chat } from "./client";

export const K_RECENT = 6;
export const SUMMARIZE_THRESHOLD = 12;
export const SUMMARIZE_INTERVAL = 4;

const SUMMARIZER_PROMPT = `你是对话摘要助手。用 80 字以内中文，总结这段对话的关键事实和未决问题。
忽略寒暄。重点保留：用户的问题、AI 的核心建议、提到的人 / 事 / 时间。
直接输出摘要，不加"摘要："等前缀。`;

export type SummarizeResult = "ok" | "skipped" | "error";

/**
 * 触发对话摘要（K_RECENT=6 / 阈值=12 / 间隔=4）
 *
 * - 消息总数 < 阈值 → "skipped"
 * - 否则取前 N-K 条压成摘要写到 conversations.summary
 * - chat 失败时返回 "error" 不抛
 */
export async function summarize(conversationId: string): Promise<SummarizeResult> {
  const db = getDb();
  try {
    const allMsgs = await db
      .select({
        role: messages.role,
        content: messages.content,
        created_at: messages.created_at,
      })
      .from(messages)
      .where(eq(messages.conversation_id, conversationId))
      .orderBy(asc(messages.created_at))
      .limit(1000);

    if (allMsgs.length < SUMMARIZE_THRESHOLD) {
      return "skipped";
    }

    const cutoff = allMsgs.length - K_RECENT;
    const oldMsgs = allMsgs.slice(0, cutoff);
    const transcript = oldMsgs
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 6000);

    const ai = await chat({
      systemPrompt: SUMMARIZER_PROMPT,
      messages: [{ role: "user", content: transcript }],
      stream: false,
      meta: { conversationId, userId: "summarizer" },
    });

    await db
      .update(conversations)
      .set({ summary: ai.text.trim(), summary_msg_count: cutoff })
      .where(eq(conversations.id, conversationId));

    return "ok";
  } catch (e) {
    console.error("summarizer 失败", e);
    return "error";
  }
}

export interface BuildPromptArgs {
  systemPrompt: string;
  summary: string | null;
  recent: Array<{ role: "user" | "assistant"; content: string }>;
  userText: string;
}

export interface ChatPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * 拼出 multi-turn prompt：
 *
 * - 第一条 system = 角色 prompt
 * - 第二条 system = "[此前对话摘要] ..."（可选）
 * - 中间 K_RECENT 条原话历史
 * - 最后一条 user = 当前提问
 */
export function buildPromptMessages(args: BuildPromptArgs): ChatPromptMessage[] {
  const out: ChatPromptMessage[] = [{ role: "system", content: args.systemPrompt }];
  if (args.summary && args.summary.trim().length > 0) {
    out.push({ role: "system", content: `[此前对话摘要]\n${args.summary.trim()}` });
  }
  for (const m of args.recent) {
    out.push({ role: m.role, content: m.content });
  }
  out.push({ role: "user", content: args.userText });
  return out;
}

/**
 * 是否需要触发摘要：
 *
 * - 消息总数 ≥ 阈值（12）
 * - 距上一次摘要又增长了 ≥ 间隔条（4）
 */
export function shouldSummarize(totalMessages: number, lastSummaryMsgCount: number): boolean {
  return (
    totalMessages >= SUMMARIZE_THRESHOLD &&
    totalMessages - lastSummaryMsgCount >= SUMMARIZE_INTERVAL
  );
}
