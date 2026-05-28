import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

const DREAM_ENTRY_RE = /^我要\s*(AI)?\s*解梦/i;

export function parseMessageUi(metadata: string | null | undefined): string | undefined {
  if (!metadata) return undefined;
  try {
    return (JSON.parse(metadata) as { ui?: string }).ui;
  } catch {
    return undefined;
  }
}

/**
 * 解梦引导卡已出现后，用户直接在底部输入框描述梦境 → 走 /api/divination/dream fast，
 * 避免再次 /api/chat 只回闲聊或重复 dream_choice 卡。
 */
export function shouldSendDreamFastSubAction(
  messages: DisplayMessage[],
  text: string,
  dreamFastWaiting: boolean,
): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (DREAM_ENTRY_RE.test(trimmed)) return false;

  if (dreamFastWaiting) return true;

  const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAsst) return false;

  const ui = parseMessageUi(lastAsst.metadata);
  if (ui === "dream_choice") return true;
  if (ui === "text" && /梦/.test(lastAsst.content ?? "")) return true;

  return false;
}
