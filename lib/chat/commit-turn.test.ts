import { describe, it, expect } from "vitest";
import { commitTurn } from "./commit-turn";
import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

describe("commitTurn", () => {
  it("停止生成时保留已流式 patch 的正文，不被空 shell card 覆盖", () => {
    const shell: DisplayMessage = {
      id: "msg-1",
      role: "assistant",
      content: "",
      created_at: "2026-01-01T00:00:00.000Z",
      metadata: JSON.stringify({ ui: "bazi_result", aiText: "" }),
    };
    const patched: DisplayMessage = {
      ...shell,
      content: "已输出第一段解读",
      metadata: JSON.stringify({ ui: "bazi_result", aiText: "已输出第一段解读" }),
    };
    const prev = [patched];
    const next = commitTurn(prev, "已输出第一段解读", [shell]);
    expect(next).toHaveLength(1);
    expect(next[0].content).toBe("已输出第一段解读");
    const meta = JSON.parse(next[0].metadata!) as { aiText: string };
    expect(meta.aiText).toBe("已输出第一段解读");
  });
});
