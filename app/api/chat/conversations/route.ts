import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * /api/chat/conversations — 历史抽屉数据源 (M2.21, spec §4.6)
 *
 * GET ?limit=&offset=&intent=
 *   返回当前用户的对话列表，按 last_message_at DESC 排序，加 group 标签：
 *   today / yesterday / 7days / older
 *   preview = summary || (first user message slice 0-30)
 *
 * POST {} → 创建一条空对话 { id }
 *   ChatWindow 第一次进入若无 conversationId 走这里建一条。
 */

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  intent: z.enum(["chat", "divination", "dream", "bazi", "meihua"]).optional(),
});

const postBodySchema = z
  .object({
    title: z.string().trim().max(60).optional(),
    intent: z.enum(["chat", "divination", "dream", "bazi", "meihua"]).optional(),
  })
  .optional();

interface ConversationRow {
  id: string;
  title: string;
  summary: string | null;
  last_intent: string | null;
  last_message_at: string | null;
  created_at: string | null;
}

interface ConversationListItem {
  id: string;
  title: string;
  preview: string;
  lastIntent: string | null;
  lastMessageAt: string | null;
  group: "today" | "yesterday" | "7days" | "older";
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    intent: url.searchParams.get("intent") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "参数错误", 400);
  }
  const { limit, offset, intent } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  const where = intent
    ? and(eq(conversations.user_id, userId), eq(conversations.last_intent, intent))
    : eq(conversations.user_id, userId);

  const rows: ConversationRow[] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      summary: conversations.summary,
      last_intent: conversations.last_intent,
      last_message_at: conversations.last_message_at,
      created_at: conversations.created_at,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.last_message_at), desc(conversations.created_at))
    .limit(limit)
    .offset(offset);

  // 拉每个对话的首条 user message 作为 preview fallback（仅 summary 为空时）
  const needPreviewIds = rows.filter((r) => !r.summary).map((r) => r.id);
  const previews = new Map<string, string>();
  if (needPreviewIds.length > 0) {
    const previewRows = await db
      .select({
        conversation_id: messages.conversation_id,
        content: messages.content,
        created_at: messages.created_at,
      })
      .from(messages)
      .where(
        and(
          eq(messages.role, "user"),
          // SQLite 没有 IN 数组直接绑定的语法糖，用 sql 模板
          sql`${messages.conversation_id} IN (${sql.join(
            needPreviewIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      )
      .orderBy(messages.created_at);

    for (const m of previewRows) {
      if (!previews.has(m.conversation_id)) {
        previews.set(m.conversation_id, m.content);
      }
    }
  }

  const items: ConversationListItem[] = rows.map((r) => {
    const previewSrc = r.summary || previews.get(r.id) || "";
    return {
      id: r.id,
      title: r.title,
      preview: previewSrc.slice(0, 30),
      lastIntent: r.last_intent,
      lastMessageAt: r.last_message_at,
      group: groupByDate(r.last_message_at ?? r.created_at),
    };
  });

  return Response.json({ items, limit, offset, hasMore: items.length === limit });
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) raw = JSON.parse(text);
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }

  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "校验失败", 400);
  }
  const data = parsed.data ?? {};

  const userId = await ensureUserId();
  const db = getDb();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(conversations).values({
    id,
    user_id: userId,
    title: data.title ?? "新对话",
    last_intent: data.intent ?? null,
    last_message_at: now,
  });

  return Response.json({ id, title: data.title ?? "新对话" }, { status: 201 });
}

function groupByDate(iso: string | null): ConversationListItem["group"] {
  if (!iso) return "older";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "older";
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.floor((now - t) / dayMs);
  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "yesterday";
  if (dayDiff <= 7) return "7days";
  return "older";
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
