import { describe, expect, it } from "vitest";
import { mergeSlipDrawReveal } from "./merge-slip-draw-reveal";
import type { DisplayMessage } from "@/app/chat/_components/MessageBubble";

describe("mergeSlipDrawReveal", () => {
  it("合并到已有动效消息并保持 ui=slip_draw_reveal + slipMessageId", () => {
    const prev: DisplayMessage[] = [
      {
        id: "local-draw-1",
        role: "assistant",
        content: "",
        created_at: "2026-01-01T00:00:00.000Z",
        metadata: JSON.stringify({ ui: "slip_draw_reveal", phase: "animating" }),
      },
    ];
    const next = mergeSlipDrawReveal(prev, "local-draw-1", {
      id: "db-slip-99",
      role: "assistant",
      content: "第 6 签 · 福渐来",
      metadata: JSON.stringify({
        ui: "slip_image",
        slipNumber: 6,
        title: "福渐来",
        poemLines: ["a", "b", "c", "d"],
        imageUrl: "/api/divination/slip-image/6",
      }),
    });
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("local-draw-1");
    const meta = JSON.parse(next[0].metadata ?? "{}") as Record<string, unknown>;
    expect(meta.ui).toBe("slip_draw_reveal");
    expect(meta.slipMessageId).toBe("db-slip-99");
    expect(meta.slipNumber).toBe(6);
  });

  it("动效消息未落入 state 时补建一条，不追加第二条", () => {
    const prev: DisplayMessage[] = [];
    const next = mergeSlipDrawReveal(prev, "local-draw-2", {
      id: "db-slip-2",
      role: "assistant",
      content: "第 1 签",
      metadata: JSON.stringify({ ui: "slip_image", slipNumber: 1 }),
    });
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("local-draw-2");
    expect(JSON.parse(next[0].metadata ?? "{}")).toMatchObject({
      ui: "slip_draw_reveal",
      slipMessageId: "db-slip-2",
    });
  });
});
