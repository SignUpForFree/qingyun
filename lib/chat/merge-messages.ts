import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

/**
 * 按消息 id 合并列表：已存在则原位替换，否则追加。
 * 避免 explain 幂等 / 刷新后会话重载时重复 push 相同 DB id → React duplicate key。
 */
export function mergeMessagesById(
  prev: DisplayMessage[],
  incoming: DisplayMessage[],
): DisplayMessage[] {
  if (incoming.length === 0) return prev;
  const next = [...prev];
  const indexById = new Map(prev.map((m, i) => [m.id, i]));
  for (const m of incoming) {
    const idx = indexById.get(m.id);
    if (idx !== undefined) {
      next[idx] = m;
    } else {
      indexById.set(m.id, next.length);
      next.push(m);
    }
  }
  return next;
}
