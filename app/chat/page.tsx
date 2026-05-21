import { and, asc, eq } from "drizzle-orm";
import { ChatWindow } from "./_components/ChatWindow";
import { getCurrentUserId } from "@/lib/auth/session";
import { LoginGate } from "@/components/auth/LoginGate";
import { getDb } from "@/lib/db/client";
import { conversations, messages, profiles } from "@/lib/db/schema";
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
    /** M4.10: ?prefill=xxx → 预填到输入框（不自动 send） */
    prefill?: string;
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
  const prefill = sp.prefill && sp.prefill.length > 0 ? sp.prefill : undefined;

  let initialMessages: DisplayMessage[] = [];
  let resolvedConvId: string | null = null;

  const userId = await getCurrentUserId();
  const isDev = process.env.NODE_ENV !== "production";

  // 生产：无 cookie 走登录门（与首页一致）；dev 由 ChatWindow mount 调 /api/dev-login
  if (!userId && !isDev) {
    return <LoginGate />;
  }

  const db = getDb();
  let userAvatarUrl: string | null = null;
  let userNickname = "我";
  if (userId) {
    const defaultProfileRow = await db
      .select({ nickname: profiles.nickname, avatar_url: profiles.avatar_url })
      .from(profiles)
      .where(and(eq(profiles.user_id, userId), eq(profiles.is_default, true)))
      .limit(1);
    userAvatarUrl = defaultProfileRow[0]?.avatar_url ?? null;
    userNickname = defaultProfileRow[0]?.nickname ?? "我";
  }

  if (cid && userId) {
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
      <ChatWindow
        key={resolvedConvId ?? "new"}
        conversationId={resolvedConvId}
        initialMessages={initialMessages}
        autoSendText={initial}
        initialIntent={intent}
        openHistoryOnMount={openHistory}
        prefillText={prefill}
        userAvatarUrl={userAvatarUrl}
        userNickname={userNickname}
        needsDevBootstrap={isDev && !userId}
      />
    </>
  );
}
