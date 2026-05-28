import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";
import { mergeMessagesById } from "@/lib/chat/merge-messages";

/** 取消息已展示正文的有效长度（content 与 metadata.aiText 取较大） */
export function messageTextLength(m: DisplayMessage): number {
  let len = (m.content ?? "").length;
  if (!m.metadata) return len;
  try {
    const meta = JSON.parse(m.metadata) as { aiText?: string };
    const aiLen = (meta.aiText ?? "").length;
    if (aiLen > len) len = aiLen;
  } catch {
    /* ignore */
  }
  return len;
}

/** 停止生成时保留已流式写入的较完整版本，避免 shell card 空内容覆盖 */
export function pickRicherMessage(
  live: DisplayMessage,
  incoming: DisplayMessage,
): DisplayMessage {
  if (messageTextLength(live) >= messageTextLength(incoming)) {
    return live;
  }
  return incoming;
}

/**
 * 回合结束合并：卡片以 id 合并进列表；无卡仅有正文时补 assistant 气泡。
 * 同 id 时优先保留 prev 中已流式写入的更长正文（用户点「停止」场景）。
 */
export function commitTurn(
  prev: DisplayMessage[],
  assistantText: string,
  cards: DisplayMessage[],
): DisplayMessage[] {
  const incoming: DisplayMessage[] = cards.map((card) => {
    const live = prev.find((m) => m.id === card.id);
    if (!live) return card;
    return pickRicherMessage(live, card);
  });

  if (assistantText && incoming.length === 0) {
    incoming.unshift({
      id: `tmp-asst-${Date.now()}`,
      role: "assistant",
      content: assistantText,
      created_at: new Date().toISOString(),
    });
  }

  return mergeMessagesById(prev, incoming);
}
