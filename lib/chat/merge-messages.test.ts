import { describe, it, expect } from "vitest";
import { mergeMessagesById } from "./merge-messages";
import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

function msg(id: string): DisplayMessage {
  return {
    id,
    role: "assistant",
    content: `content-${id}`,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("mergeMessagesById", () => {
  it("追加新 id", () => {
    const prev = [msg("a")];
    const next = mergeMessagesById(prev, [msg("b")]);
    expect(next.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("相同 id 原位替换，不重复", () => {
    const dup = "2ca43bf3-6237-4006-814f-9ec953aaf850";
    const prev = [msg("a"), msg(dup)];
    const updated = {
      ...msg(dup),
      content: "updated interpretation",
    };
    const next = mergeMessagesById(prev, [updated]);
    expect(next).toHaveLength(2);
    expect(next[1].content).toBe("updated interpretation");
    expect(new Set(next.map((m) => m.id)).size).toBe(2);
  });

  it("incoming 为空时返回原数组引用内容等价", () => {
    const prev = [msg("a")];
    expect(mergeMessagesById(prev, [])).toEqual(prev);
  });
});
