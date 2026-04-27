import { and, asc, eq } from "drizzle-orm";
import { AppHeader } from "@/components/layout";
import { ChatWindow } from "./_components/ChatWindow";
import { HistoryDrawer } from "./_components/HistoryDrawer";
import { ensureUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import type { DisplayMessage } from "./_components/MessageBubble";

/**
 * /chat 单一聊天路由（V1.0 文档 §4.2 路由合并）
 *
 * - /chat               → 新对话
 * - /chat?cid=xxx       → 继续指定会话（验证归属，不归属者降级到新对话）
 * - /chat?initial=xxx   → 自动发送首条消息（来自首页 4 入口卡 / 旧 /chat/new 链接）
 * - /chat?cid=xxx&initial=yyy → 兼有
 *
 * 老路由 /chat/[sessionId] 同步保留（仅做透传），逐步淘汰。
 */
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    cid?: string;
    initial?: string;
    /** M2.24: ?intent=divination|dream|bazi|meihua → mount 时 auto-send */
    intent?: string;
    /** M2.24: ?open=history → mount 时打开历史抽屉 */
    open?: string;
  }>;
}

const VALID_INTENTS = new Set(["divination", "dream", "bazi", "meihua"]);

export default async function ChatPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const cid = sp.cid && sp.cid.length > 0 ? sp.cid : null;
  const initial = sp.initial;
  const intent = sp.intent && VALID_INTENTS.has(sp.intent)
    ? (sp.intent as "divination" | "dream" | "bazi" | "meihua")
    : null;
  const openHistory = sp.open === "history";

  let initialMessages: DisplayMessage[] = [];
  let resolvedConvId: string | null = null;

  if (cid) {
    const userId = await ensureUserId();
    const db = getDb();
    const owned = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, cid), eq(conversations.user_id, userId)))
      .limit(1);
    if (owned[0]) {
      resolvedConvId = cid;
      initialMessages = await db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          created_at: messages.created_at,
          metadata: messages.metadata,
        })
        .from(messages)
        .where(eq(messages.conversation_id, cid))
        .orderBy(asc(messages.created_at));
    }
  }

  return (
    <>
      <AppHeader
        title={resolvedConvId ? "对话" : "AI 问答"}
        right={<HistoryDrawer currentId={resolvedConvId ?? undefined} />}
      />
      <ChatWindow
        conversationId={resolvedConvId}
        initialMessages={initialMessages}
        autoSendText={initial}
        initialIntent={intent}
        openHistoryOnMount={openHistory}
      />
    </>
  );
}
