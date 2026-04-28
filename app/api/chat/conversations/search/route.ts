import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { ensureUserId } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * /api/chat/conversations/search — 会话全文搜索 (M2.22, spec §4.6)
 *
 * GET ?q=<2+ chars>
 *   2 字（如 "梅花" / "八字"）走 LIKE %q% 兜底（FTS5 trigram 需 3+ 字才命中）。
 *   3+ 字走 FTS5 trigram + snippet 高亮。
 *   严格 user_id 隔离，避免跨用户泄漏。limit 固定 20。
 *
 * 返回 { items: [{ id, title, lastMessageAt, snippet }] }
 */

const querySchema = z.object({
  q: z.string().trim().min(2).max(60),
});

interface SearchHit {
  id: string;
  title: string;
  last_message_at: string | null;
  snippet: string | null;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "请输入 2 字以上关键词", 400);
  }
  const { q } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  // 2 字 LIKE 兜底；3+ 字走 FTS5 trigram
  const useFts = q.length >= 3;
  const sql = useFts
    ? `
    SELECT DISTINCT
      c.id AS id,
      c.title AS title,
      c.last_message_at AS last_message_at,
      snippet(messages_fts, 0, '<b>', '</b>', '...', 8) AS snippet
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    JOIN messages_fts ON messages_fts.rowid = m.rowid
    WHERE c.user_id = ? AND messages_fts MATCH ?
    ORDER BY c.last_message_at DESC
    LIMIT 20
  `
    : `
    SELECT DISTINCT
      c.id AS id,
      c.title AS title,
      c.last_message_at AS last_message_at,
      substr(m.content, max(1, instr(m.content, ?) - 8), 64) AS snippet
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ? AND (m.content LIKE ? OR c.title LIKE ?)
    ORDER BY c.last_message_at DESC
    LIMIT 20
  `;

  let hits: SearchHit[];
  try {
    if (useFts) {
      hits = db.$client.prepare(sql).all(userId, q) as SearchHit[];
    } else {
      const like = `%${q}%`;
      hits = db.$client.prepare(sql).all(q, userId, like, like) as SearchHit[];
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("search 失败", e);
    }
    return jsonError("搜索关键词非法（含特殊字符）", 400);
  }

  return Response.json({
    items: hits.map((h) => ({
      id: h.id,
      title: h.title,
      lastMessageAt: h.last_message_at,
      snippet: h.snippet ?? "",
    })),
    q,
    count: hits.length,
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
