import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { AppHeader } from "@/components/layout";
import { ChatWindow } from "../_components/ChatWindow";
import { HistoryDrawer } from "../_components/HistoryDrawer";
import type { DisplayMessage } from "../_components/MessageBubble";
import { ensureUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import type { Intent } from "@/types/domain";

const INTENT_VALUES: readonly Intent[] = [
  "chat",
  "divination",
  "dream",
  "bazi",
  "meihua",
];

function isIntent(s: string | undefined): s is Intent {
  return s !== undefined && (INTENT_VALUES as readonly string[]).includes(s);
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ intent?: string; initial?: string }>;
}

/**
 * /chat/[sessionId] RSC：服务端预拉历史消息
 *
 * - sessionId === 'new' → 空消息列表，沿用 intent / initial 参数
 * - 其它 → 校验会话归属，按 created_at asc 拉 messages（含 metadata 用于卡片渲染）
 *
 * 不存在或非自己的会话 → 回到 /chat 列表
 */
export const dynamic = "force-dynamic";

export default async function ChatSessionPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const isNew = sessionId === "new";
  const intentHint = isIntent(sp.intent) ? sp.intent : undefined;
  const initial = sp.initial;

  let initialMessages: DisplayMessage[] = [];
  let resolvedConversationId: string | null = isNew ? null : sessionId;

  if (!isNew) {
    const userId = await ensureUserId();
    const db = getDb();

    const owned = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, sessionId), eq(conversations.user_id, userId)))
      .limit(1);

    if (!owned[0]) {
      // 不归你 / 不存在 → 当作新会话处理（不暴露 404 细节）
      resolvedConversationId = null;
    } else {
      const rows = await db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          created_at: messages.created_at,
          metadata: messages.metadata,
        })
        .from(messages)
        .where(eq(messages.conversation_id, sessionId))
        .orderBy(asc(messages.created_at));
      initialMessages = rows;
    }
  }

  const title =
    isNew && intentHint
      ? intentLabel(intentHint)
      : isNew
        ? "新对话"
        : "对话";

  return (
    <>
      <AppHeader
        title={title}
        left={<HistoryDrawer currentId={isNew ? undefined : sessionId} />}
        right={<BackLink />}
      />
      <ChatWindow
        conversationId={resolvedConversationId}
        initialMessages={initialMessages}
        autoSendText={initial}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/chat"
      className="text-sm text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
      aria-label="返回对话列表"
    >
      ←
    </Link>
  );
}

function intentLabel(i: Intent): string {
  switch (i) {
    case "divination":
      return "抽签";
    case "dream":
      return "解梦";
    case "bazi":
      return "八字";
    case "meihua":
      return "起卦";
    default:
      return "对话";
  }
}
