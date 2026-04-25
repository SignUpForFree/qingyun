"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { ChatWindow } from "../_components/ChatWindow";
import { HistoryDrawer } from "../_components/HistoryDrawer";
import type { Intent } from "@/types/domain";

const INTENT_VALUES: readonly Intent[] = ["chat", "divination", "dream", "bazi", "meihua"];

function isIntent(s: string | null): s is Intent {
  return s !== null && (INTENT_VALUES as readonly string[]).includes(s);
}

/**
 * /chat/[sessionId] 单会话页
 *
 * P1 阶段：纯 client 版，不预拉历史消息（messages 由 client 通过 SSE 累积）。
 * Supabase 接入后（W2）升级为 RSC：
 *   - sessionId === "new" → 空消息列表
 *   - 其它 → server 端 select messages where conversation_id = sessionId
 */
export default function ChatSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const search = useSearchParams();

  const sessionId = params.sessionId;
  const isNew = sessionId === "new";
  const intentParam = search.get("intent");
  const intentHint = isIntent(intentParam) ? intentParam : undefined;
  const initial = search.get("initial") ?? undefined;

  const title = React.useMemo(() => {
    if (isNew && intentHint) return intentLabel(intentHint);
    if (isNew) return "新对话";
    return "对话";
  }, [isNew, intentHint]);

  return (
    <>
      <AppHeader
        title={title}
        left={<HistoryDrawer currentId={isNew ? undefined : sessionId} />}
        right={<BackLink />}
      />
      <ChatWindow
        conversationId={isNew ? null : sessionId}
        initialMessages={[]}
        intentHint={intentHint}
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
