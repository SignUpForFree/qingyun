import { describe, expect, it } from "vitest";
import {
  ALL_CARD_UI_TYPES,
  CardMetaSchema,
  isCardMeta,
  parseCardMeta,
  stringifyCardMeta,
  type CardMeta,
} from "./chat-ui";

describe("CardMeta union (M2.4 — 22 ui types)", () => {
  it("ALL_CARD_UI_TYPES 含 22 条且全部唯一", () => {
    expect(ALL_CARD_UI_TYPES).toHaveLength(22);
    expect(new Set(ALL_CARD_UI_TYPES).size).toBe(22);
  });

  it("CardMetaSchema discriminated union 包含 22 个分支", () => {
    const def = CardMetaSchema._def;
    expect(def.options).toHaveLength(22);
  });
});

describe("isCardMeta — 正样本（每个 ui type 至少一条最小样本）", () => {
  const minimalSamples: ReadonlyArray<readonly [string, CardMeta]> = [
    [
      "intent_pending",
      { ui: "intent_pending" },
    ],
    [
      "progress_long_task",
      { ui: "progress_long_task", etaSec: 30, stage: "computing" },
    ],
    [
      "error_card",
      { ui: "error_card", message: "AI 卡了一下", code: "ai_timeout", retryable: true },
    ],
    [
      "choice_card",
      {
        ui: "choice_card",
        question: "你想问什么？",
        options: [{ key: "a", label: "选项A" }, { key: "b", label: "选项B" }],
      },
    ],
    [
      "profile_picker",
      {
        ui: "profile_picker",
        profiles: [
          {
            id: "5d8e2b6e-c0c4-4a3a-8d1e-2f4e7c1a3b9c",
            nickname: "我自己",
            isDefault: true,
          },
        ],
      },
    ],
    [
      "slip_type_picker",
      {
        ui: "slip_type_picker",
        options: [
          { key: "career", label: "事业学业" },
          { key: "wealth", label: "财运" },
        ],
      },
    ],
    [
      "bazi_focus_picker",
      {
        ui: "bazi_focus_picker",
        options: [{ key: "career", label: "事业学业" }],
      },
    ],
    [
      "slip_question_input",
      { ui: "slip_question_input", category: "事业学业" },
    ],
    [
      "bazi_quick_form",
      { ui: "bazi_quick_form", fields: ["gender", "birth_time"] },
    ],
    [
      "meihua_number_input",
      {
        ui: "meihua_number_input",
        profileId: "6e9f3c7d-d1d5-4b4b-9e2f-3a5f8d2b4c0d",
        numberCount: 3,
      },
    ],
    [
      "dream_precise_form",
      { ui: "dream_precise_form", fields: ["core", "emotion"] },
    ],
    [
      "slip_drawing",
      { ui: "slip_drawing", durationMs: 2000 },
    ],
    [
      "slip_image",
      {
        ui: "slip_image",
        slipNumber: 42,
        level: "上吉",
        title: "渔翁得利",
        poemLines: ["一", "二", "三", "四"],
        imageUrl: "/api/divination/slip-image/42",
      },
    ],
    [
      "slip_report",
      {
        ui: "slip_report",
        slipNumber: 42,
        level: "上吉",
        title: "渔翁得利",
        poem: "一二三四",
        dimension: "事业学业",
        reading: "解签词",
        aiInterpretation: "AI 解读",
      },
    ],
    [
      "dream_result_fast",
      { ui: "dream_result_fast", summary: "梦境一句话总结" },
    ],
    [
      "dream_result_precise",
      {
        ui: "dream_result_precise",
        threeViews: { psychology: "心理学视角", zhouGong: "周公解梦", modern: "现代解读" },
        summary: "汇总",
        suggestions: ["建议1", "建议2"],
      },
    ],
    [
      "bazi_result",
      {
        ui: "bazi_result",
        profileId: "7faf4d8e-e2e6-4c5c-8f3f-4b6f9e3c5d1e",
        focus: "事业学业",
        chart: { pillars: {} },
        aiText: "...",
      },
    ],
    [
      "meihua_result",
      {
        ui: "meihua_result",
        profileId: "7faf4d8e-e2e6-4c5c-8f3f-4b6f9e3c5d1e",
        benGua: "乾",
        huGua: "兑",
        bianGua: "离",
        dongYao: 3,
        tiYong: "体生用",
        yingQi: "三日内",
        verdict: "吉",
        aiText: "...",
      },
    ],
    [
      "fortune_brief_card",
      {
        ui: "fortune_brief_card",
        date: "2026-04-27",
        overall: 78,
        topDimension: "事业",
        oneLiner: "今日宜进取",
      },
    ],
    [
      "summary_card",
      { ui: "summary_card", summary: "已记下：你最近问婚姻较多", messagesCount: 12 },
    ],
    [
      "profile_added_hint",
      {
        ui: "profile_added_hint",
        profileId: "7faf4d8e-e2e6-4c5c-8f3f-4b6f9e3c5d1e",
        nickname: "我妈",
      },
    ],
    [
      "quick_action_chips",
      {
        ui: "quick_action_chips",
        chips: [
          { key: "draw", label: "抽个签", intent: "divination" },
          { key: "bazi", label: "看八字", intent: "bazi" },
        ],
      },
    ],
  ];

  it("覆盖 22 个 ui 全部正样本", () => {
    expect(minimalSamples).toHaveLength(22);
    const uis = minimalSamples.map(([k]) => k).sort();
    expect(uis).toEqual([...ALL_CARD_UI_TYPES].sort());
  });

  it.each(minimalSamples)("isCardMeta %s 通过", (_label, meta) => {
    expect(isCardMeta(meta)).toBe(true);
  });

  it.each(minimalSamples)("CardMetaSchema.parse %s 不抛", (_label, meta) => {
    expect(() => CardMetaSchema.parse(meta)).not.toThrow();
  });

  it.each(minimalSamples)("stringifyCardMeta + parseCardMeta 往返一致 %s", (_label, meta) => {
    const s = stringifyCardMeta(meta);
    const back = parseCardMeta(s);
    expect(back).not.toBeNull();
    expect(back?.ui).toBe(meta.ui);
  });
});

describe("isCardMeta — 负样本", () => {
  it("拒绝未知 ui", () => {
    expect(isCardMeta({ ui: "unknown_x" })).toBe(false);
  });

  it("拒绝缺 ui 字段", () => {
    expect(isCardMeta({ message: "no ui" })).toBe(false);
  });

  it("拒绝 null / undefined / primitive", () => {
    expect(isCardMeta(null)).toBe(false);
    expect(isCardMeta(undefined)).toBe(false);
    expect(isCardMeta("string")).toBe(false);
    expect(isCardMeta(42)).toBe(false);
  });

  it("拒绝 ui 正确但必填字段缺失", () => {
    expect(isCardMeta({ ui: "slip_image" })).toBe(false);
    expect(isCardMeta({ ui: "error_card" })).toBe(false); // 缺 message
  });

  it("拒绝 slip_image poemLines 非 4 句", () => {
    expect(
      isCardMeta({
        ui: "slip_image",
        slipNumber: 1,
        level: "上吉",
        title: "x",
        poemLines: ["一", "二"],
        imageUrl: "/x",
      }),
    ).toBe(false);
  });

  it("拒绝非法 level / dongYao", () => {
    expect(
      isCardMeta({
        ui: "slip_image",
        slipNumber: 1,
        level: "无敌",
        title: "x",
        poemLines: ["一", "二", "三", "四"],
        imageUrl: "/x",
      }),
    ).toBe(false);
  });
});

describe("parseCardMeta — 字符串入口", () => {
  it("合法 JSON 合法 schema → 返回对象", () => {
    const r = parseCardMeta(JSON.stringify({ ui: "intent_pending" }));
    expect(r).not.toBeNull();
    expect(r?.ui).toBe("intent_pending");
  });

  it("非法 JSON → null", () => {
    expect(parseCardMeta("not-json")).toBeNull();
  });

  it("合法 JSON 但 schema 不通过 → null", () => {
    expect(parseCardMeta(JSON.stringify({ ui: "x" }))).toBeNull();
  });
});

describe("stringifyCardMeta — 写入前校验", () => {
  it("正样本可写", () => {
    const s = stringifyCardMeta({ ui: "intent_pending" });
    expect(JSON.parse(s)).toEqual({ ui: "intent_pending" });
  });

  it("非法对象写入抛错（防 messages.metadata 污染）", () => {
    expect(() =>
      stringifyCardMeta({ ui: "error_card" } as unknown as CardMeta),
    ).toThrow();
  });
});
