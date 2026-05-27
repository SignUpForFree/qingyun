import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

/** 流式更新 meihua_result 卡：只改 content + metadata.aiText */
export function patchMeihuaStreamingMessage(
  messages: DisplayMessage[],
  messageId: string,
  rawAiText: string,
): DisplayMessage[] {
  const displayText = rawAiText;
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    let metadata = m.metadata;
    if (metadata) {
      try {
        const meta = JSON.parse(metadata) as Record<string, unknown>;
        meta.aiText = displayText;
        metadata = JSON.stringify(meta);
      } catch {
        /* 保持原 metadata */
      }
    }
    return { ...m, content: displayText, metadata };
  });
}
