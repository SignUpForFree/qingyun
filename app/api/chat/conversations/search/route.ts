import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { ensureUserId } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * /api/chat/conversations/search — FTS5 全文搜索 (M2.22, spec §4.6)
 *
 * GET ?q=<3+ chars>
 *   FTS5 trigram 分词需要 3+ 字才能命中，前端 UI 也只允许 3+ 字搜索。
 *   严格 user_id 隔离，避免跨用户泄漏。
 *   limit 固定 20。
 *
 * 返回 { items: [{ id, title, lastMessageAt, snippet }] }
 */

const querySchema = z.object({
  q: z.string().trim().min(3).max(60),
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
    return jsonError(parsed.error.issues[0]?.message ?? "请输入 3 字以上关键词", 400);
  }
  const { q } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  // FTS5 query 接 trigram 分词；用 snippet() 取上下文段落
  const sql = `
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
  `;

  let hits: SearchHit[];
  try {
    hits = db.$client.prepare(sql).all(userId, q) as SearchHit[];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("FTS5 search 失败", e);
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
