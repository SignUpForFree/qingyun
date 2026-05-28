import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

/** 解梦流式占位卡（客户端临时 id，回合结束由服务端 card 替换） */
export function createDreamStreamingShell(): DisplayMessage {
  const id = `dream-stream-${Date.now()}`;
  return {
    id,
    role: "assistant",
    content: "",
    metadata: JSON.stringify({ ui: "dream_result_fast" }),
    created_at: new Date().toISOString(),
  };
}

export function isDreamStreamingShellId(id: string): boolean {
  return id.startsWith("dream-stream-");
}

/** 流式更新 dream_result_fast 卡正文 */
export function patchDreamStreamingMessage(
  messages: DisplayMessage[],
  messageId: string,
  rawAiText: string,
): DisplayMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    return { ...m, content: rawAiText };
  });
}
