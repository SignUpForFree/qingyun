import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";

/**
 * 历史抽屉对话预览（M2.26, spec §4.6）
 *
 * 选取规则：
 *   1. 优先用 conversations.summary（摘要器结果，由 lib/ai/summarizer.ts 写）
 *   2. fallback：取 conversation 第一条 user message，截 30 字
 *   3. 都没有 → 空字符串
 */
const PREVIEW_LEN = 30;

export function previewFromSummary(summary: string | null): string {
  if (!summary) return "";
  return summary.trim().slice(0, PREVIEW_LEN);
}

export function previewFromContent(content: string | null | undefined): string {
  if (!content) return "";
  return content.trim().slice(0, PREVIEW_LEN);
}

/**
 * 静态版：给定 summary + 第一条 user content，返回预览
 */
export function preview(opts: {
  summary?: string | null;
  firstUserContent?: string | null;
}): string {
  const fromSummary = previewFromSummary(opts.summary ?? null);
  if (fromSummary) return fromSummary;
  return previewFromContent(opts.firstUserContent ?? "");
}

/**
 * 异步版：给定 conversation summary + conversationId，自己拉第一条 user message
 */
export async function loadPreview(
  conversationId: string,
  summary: string | null,
): Promise<string> {
  const fromSummary = previewFromSummary(summary);
  if (fromSummary) return fromSummary;

  const db = getDb();
  const rows = await db
    .select({ content: messages.content })
    .from(messages)
    .where(eq(messages.conversation_id, conversationId))
    .orderBy(asc(messages.created_at))
    .limit(5);

  for (const m of rows) {
    if (m.content?.trim()) return previewFromContent(m.content);
  }
  return "";
}
