import { describe, it, expect } from "vitest";
import { shouldSendDreamFastSubAction } from "./dream-flow";
import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

function asst(ui: string, content = ""): DisplayMessage {
  return {
    id: `a-${ui}`,
    role: "assistant",
    content,
    created_at: new Date().toISOString(),
    metadata: JSON.stringify({ ui }),
  };
}

describe("shouldSendDreamFastSubAction", () => {
  it("dream_choice 后用户描述梦境 → true", () => {
    expect(
      shouldSendDreamFastSubAction(
        [asst("dream_choice", "请问您想快速解梦还是精准解梦？")],
        "我梦到被蛇掐住了起不来",
        false,
      ),
    ).toBe(true);
  });

  it("入口话术「我要解梦」→ false", () => {
    expect(shouldSendDreamFastSubAction([], "我要解梦", false)).toBe(false);
  });

  it("markDreamFastWaiting → true", () => {
    expect(shouldSendDreamFastSubAction([], "梦见蛇", true)).toBe(true);
  });
});
