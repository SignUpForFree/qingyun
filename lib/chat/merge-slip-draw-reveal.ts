import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

export interface SlipDrawMergeCard {
  id?: string;
  role: "assistant";
  content: string;
  metadata?: string | null;
}

/** 将 qianwen 返回的 slip_image 并入抽签一体卡（单条消息：动效 → 签面） */
export function mergeSlipDrawReveal(
  messages: DisplayMessage[],
  mergeMessageId: string,
  card: SlipDrawMergeCard,
): DisplayMessage[] {
  let slipFields: Record<string, unknown> = {};
  if (card.metadata) {
    try {
      slipFields = JSON.parse(card.metadata) as Record<string, unknown>;
    } catch {
      /* 静默 */
    }
  }

  const mergedMeta = JSON.stringify({
    ...slipFields,
    ui: "slip_draw_reveal",
    slipMessageId: card.id,
    phase: "animating",
  });

  let hit = false;
  const merged = messages.map((msg) => {
    if (msg.id !== mergeMessageId) return msg;
    hit = true;
    return {
      id: msg.id,
      role: "assistant" as const,
      content: card.content,
      created_at: msg.created_at,
      metadata: mergedMeta,
    };
  });

  if (hit) return merged;

  // 动效消息尚未落入 state 时补建，避免再追加第二条 slip_image
  return [
    ...messages,
    {
      id: mergeMessageId,
      role: "assistant" as const,
      content: card.content,
      created_at: new Date().toISOString(),
      metadata: mergedMeta,
    },
  ];
}
