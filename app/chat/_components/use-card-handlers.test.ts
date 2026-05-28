import { describe, expect, it } from "vitest";
import { applyDreamChoicePick, applySlipTypePick } from "./use-card-handlers";
import type { DisplayMessage } from "./MessageBubble";

const pickerMsg: DisplayMessage = {
  id: "picker-1",
  role: "assistant",
  content: "好的，您想求哪一类签？",
  created_at: "2026-01-01T00:00:00.000Z",
  metadata: JSON.stringify({
    ui: "slip_type_picker",
    options: [
      { key: "综合运势", label: "综合运势" },
      { key: "财运", label: "财运" },
    ],
  }),
};

describe("applyDreamChoicePick", () => {
  it("选精准解梦时只追加表单引导，不叠 fast 文案", () => {
    const dreamPicker: DisplayMessage = {
      id: "dream-picker",
      role: "assistant",
      content: "请问您想快速解梦还是精准解梦？",
      created_at: "2026-01-01T00:00:00.000Z",
      metadata: JSON.stringify({
        ui: "dream_choice",
        options: [
          { key: "fast", label: "快速解梦" },
          { key: "precise", label: "精准解梦" },
        ],
      }),
    };
    const next = applyDreamChoicePick([dreamPicker], "dream-picker", "precise");
    expect(next).toHaveLength(3);
    expect(JSON.parse(next[2]!.metadata!).ui).toBe("dream_precise_form");
    expect(next.some((m) => m.content.includes("请描述你的梦境"))).toBe(false);
  });
});

describe("applySlipTypePick", () => {
  it("collapses picker, adds user choice bubble and question form", () => {
    const next = applySlipTypePick([pickerMsg], "picker-1", "综合运势");
    expect(next).toHaveLength(3);

    const collapsed = next[0]!;
    expect(JSON.parse(collapsed.metadata!).ui).toBe("text");
    expect(collapsed.content).toBe("好的，您想求哪一类签？");

    expect(next[1]!.role).toBe("user");
    expect(next[1]!.content).toBe("综合运势");

    const form = next[2]!;
    expect(JSON.parse(form.metadata!).ui).toBe("slip_question_input");
    expect(form.content).toContain("请描述");
  });
});
