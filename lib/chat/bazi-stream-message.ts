import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

/** 流式更新 bazi_result 卡：同步 content 与 metadata.aiText */
export function patchBaziStreamingMessage(
  messages: DisplayMessage[],
  messageId: string,
  rawAiText: string,
): DisplayMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    let metadata = m.metadata;
    if (metadata) {
      try {
        const meta = JSON.parse(metadata) as Record<string, unknown>;
        meta.aiText = rawAiText;
        metadata = JSON.stringify(meta);
      } catch {
        /* 保持原 metadata */
      }
    }
    return { ...m, content: rawAiText, metadata };
  });
}
