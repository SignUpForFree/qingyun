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
  it("梦境引导文案后用户描述梦境 → true", () => {
    expect(
      shouldSendDreamFastSubAction(
        [
          asst("text", "请描述你的梦境内容（包含以下信息，描述越详细越精准）"),
        ],
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
