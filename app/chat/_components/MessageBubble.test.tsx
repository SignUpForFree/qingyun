import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble, type DisplayMessage } from "./MessageBubble";

function assistantMsg(meta: Record<string, unknown>, content = ""): DisplayMessage {
  return {
    id: "m-test",
    role: "assistant",
    content,
    metadata: JSON.stringify(meta),
    created_at: "2026-04-27T10:00:00.000Z",
  };
}

const VALID_PROFILE_ID = "5d8e2b6e-c0c4-4a3a-8d1e-2f4e7c1a3b9c";

describe("MessageBubble (M2.14 — 22 ui dispatch)", () => {
  // ============ state / transient ============

  it("intent_pending → '正在识别意图…'", () => {
    render(<MessageBubble message={assistantMsg({ ui: "intent_pending" })} />);
    expect(screen.getByText("正在识别意图…")).toBeInTheDocument();
  });

  it("progress_long_task → 进度条 + ETA", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "progress_long_task",
          etaSec: 30,
          stage: "computing",
          percent: 50,
        })}
      />,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("约 30s")).toBeInTheDocument();
  });

  it("error_card → role=alert + message", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "error_card",
          message: "AI 卡了一下",
          code: "ai_timeout",
          retryable: true,
        })}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("AI 卡了一下")).toBeInTheDocument();
  });

  it("slip_drawing → HeavenlySlipDraw 仙女撒签动效", () => {
    render(
      <MessageBubble
        message={assistantMsg({ ui: "slip_drawing", durationMs: 99999 })}
      />,
    );
    expect(screen.getByTestId("heavenly-slip-draw")).toBeInTheDocument();
  });

  it("slip_draw_reveal animating → 仙女撒签一体卡动效", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "slip_draw_reveal",
          phase: "animating",
          durationMs: 3000,
        })}
      />,
    );
    expect(screen.getByTestId("heavenly-slip-draw")).toBeInTheDocument();
    expect(screen.getByText("仙女抽签中…")).toBeInTheDocument();
  });

  // ============ pickers ============

  it("choice_card → ChoiceCard with options", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "choice_card",
          question: "请选一个",
          options: [
            { key: "a", label: "选项A" },
            { key: "b", label: "选项B" },
          ],
        })}
      />,
    );
    expect(screen.getByText("请选一个")).toBeInTheDocument();
    expect(screen.getByText("选项A")).toBeInTheDocument();
  });

  it("profile_picker → ProfilePickerCard", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "profile_picker",
          profiles: [
            { id: VALID_PROFILE_ID, nickname: "我自己", isDefault: true },
          ],
        })}
      />,
    );
    expect(screen.getByText("我自己")).toBeInTheDocument();
    expect(screen.getByText("+ 添加新档案")).toBeInTheDocument();
  });

  it("slip_type_picker → ChoiceCard", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "slip_type_picker",
          options: [{ key: "career", label: "事业学业" }],
        })}
      />,
    );
    expect(screen.getByText("事业学业")).toBeInTheDocument();
  });

  it("bazi_focus_picker → ChoiceCard", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "bazi_focus_picker",
          options: [{ key: "wealth", label: "财运" }],
        })}
      />,
    );
    expect(screen.getByText("财运")).toBeInTheDocument();
  });

  // ============ forms ============

  it("dream_precise_form → DreamPreciseFormCard with trigger button", () => {
    render(<MessageBubble message={assistantMsg({ ui: "dream_precise_form" })} />);
    expect(screen.getByText("填写梦境详情（精准解读）")).toBeInTheDocument();
  });

  it("dream_precise_form → DreamPreciseFormCard shows intro text from content", () => {
    render(
      <MessageBubble
        message={assistantMsg({ ui: "dream_precise_form" }, "第一段说明\n第二行")}
      />,
    );
    const intro = screen.getByText(/第一段说明/);
    expect(intro.textContent).toContain("第二行");
  });

  it("bazi_quick_form → FormCard with 八字 title", () => {
    render(<MessageBubble message={assistantMsg({ ui: "bazi_quick_form" })} />);
    expect(screen.getByText("请填写八字信息")).toBeInTheDocument();
  });

  it("meihua_number_input → FormCard", () => {
    render(<MessageBubble message={assistantMsg({ ui: "meihua_number_input" })} />);
    expect(screen.getByText("请报3个1-99之间的任意随机数")).toBeInTheDocument();
    expect(screen.queryByText("输入任意3个数字")).not.toBeInTheDocument();
    expect(screen.getByText("第一个数字：")).toBeInTheDocument();
    expect(screen.getByText("第二个数字：")).toBeInTheDocument();
    expect(screen.getByText("第三个数字：")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("请输入第一个数字")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("请输入第二个数字")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("请输入第三个数字")).toBeInTheDocument();
    const questionLabel = screen.getByText(/描述你想测的事情/);
    expect(questionLabel).toHaveClass("font-[family-name:var(--font-serif)]");
    expect(questionLabel).toHaveClass("text-[var(--color-ink-plum)]");
    expect(screen.getByPlaceholderText("请输入内容")).toBeInTheDocument();
  });

  it("slip_question_input → FormCard with guide copy", () => {
    render(
      <MessageBubble
        message={assistantMsg(
          { ui: "slip_question_input" },
          "请描述你遇到的事情和想问的问题，描述越具体，解读越精准哦。",
        )}
      />,
    );
    expect(
      screen.getByText("请描述你遇到的事情和想问的问题，描述越具体，解读越精准哦。"),
    ).toBeInTheDocument();
  });

  // ============ results ============

  it("slip_image (V2.0 schema with poemLines) → SlipImageFullscreen + 立即解读 button", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "slip_image",
          slipNumber: 1,
          level: "上上",
          title: "天官赐福",
          poemLines: ["a", "b", "c", "d"],
          imageUrl: "/api/divination/slip-image/1",
        })}
      />,
    );
    expect(screen.getByRole("img").getAttribute("src")).toMatch(
      /^\/api\/divination\/slip-image\/1\?layout=\d+$/,
    );
    expect(screen.getByRole("button", { name: "立即解读" })).toBeInTheDocument();
  });

  it("slip_report → SlipReportCard 解签词 + AI 解读分段", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "slip_report",
          slipNumber: 42,
          level: "上吉",
          title: "渔翁得利",
          poem: "诗",
          dimension: "事业学业",
          reading: "解签词正文",
          aiInterpretation: "AI 解读正文",
        })}
      />,
    );
    expect(screen.getByText("解签语")).toBeInTheDocument();
    expect(screen.getByText("AI 解读")).toBeInTheDocument();
    expect(screen.getByText("解签词正文")).toBeInTheDocument();
    expect(screen.getByText("AI 解读正文")).toBeInTheDocument();
  });

  it("dream_result_fast → DreamResultCard mode=fast", () => {
    render(
      <MessageBubble
        message={assistantMsg({ ui: "dream_result_fast" }, "快速解读 AI 文本")}
      />,
    );
    expect(screen.getByText("快 速 解 梦")).toBeInTheDocument();
    expect(screen.getByText("快速解读 AI 文本")).toBeInTheDocument();
  });

  it("dream_result_precise → DreamResultCard mode=precise", () => {
    render(
      <MessageBubble
        message={assistantMsg({ ui: "dream_result_precise" }, "精准解读 AI 文本")}
      />,
    );
    expect(screen.getByText("精 准 解 梦")).toBeInTheDocument();
    expect(screen.getByText("精准解读 AI 文本")).toBeInTheDocument();
  });

  it("bazi_result → BaziResultCard with focus + chart + AI text", () => {
    render(
      <MessageBubble
        message={assistantMsg(
          {
            ui: "bazi_result",
            focus: "事业学业",
            chart: {
              pillars: {
                year: { gan: "甲", zhi: "子" },
                month: { gan: "乙", zhi: "丑" },
                day: { gan: "丙", zhi: "寅" },
                hour: { gan: "丁", zhi: "卯" },
              },
              fiveElements: { 金: 1, 木: 2, 水: 1, 火: 2, 土: 2 },
              dayMaster: "丙",
              tenGods: { year: "正官", month: "偏财", hour: "比肩" },
              currentLuck: "戊辰",
            },
          },
          "AI 解读八字",
        )}
      />,
    );
    expect(screen.getByText(/八字 · 事业学业/)).toBeInTheDocument();
    expect(screen.getByText("AI 解读八字")).toBeInTheDocument();
  });

  it("meihua_result → MeihuaResultCard 三卦展示", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "meihua_result",
          ben: { number: 1, name: "乾为天", upper: "乾", lower: "乾" },
          hu: { number: 43, name: "泽天夬", upper: "兑", lower: "乾" },
          bian: { number: 13, name: "天火同人", upper: "乾", lower: "离" },
          dongYao: 3,
          tiYong: { ti: "乾", yong: "兑", relation: "yong_sheng_ti" },
          yingQi: { speed: "fast", timeHint: "三日内", branchHour: "卯时" },
          verdict: "大吉",
        })}
      />,
    );
    expect(screen.getByText("乾为天")).toBeInTheDocument();
    expect(screen.getByText("大吉")).toBeInTheDocument();
  });

  it("fortune_brief_card → 显示 overall + topDimension + oneLiner", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "fortune_brief_card",
          date: "2026-04-27",
          overall: 78,
          topDimension: "事业",
          oneLiner: "今日宜进取",
        })}
      />,
    );
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(screen.getByText("今日宜进取")).toBeInTheDocument();
  });

  // ============ auxiliary ============

  it("summary_card → 居中提示文案", () => {
    render(
      <MessageBubble
        message={assistantMsg({ ui: "summary_card" }, "已记录关于婚姻的问询")}
      />,
    );
    expect(screen.getByText(/已记录关于婚姻的问询/)).toBeInTheDocument();
  });

  it("profile_added_hint → '已新增档案 · {nickname}'", () => {
    render(
      <MessageBubble
        message={assistantMsg({ ui: "profile_added_hint", nickname: "我妈" })}
      />,
    );
    expect(screen.getByText(/已新增档案/)).toBeInTheDocument();
    expect(screen.getByText(/我妈/)).toBeInTheDocument();
  });

  it("quick_action_chips → 渲染按钮列表", () => {
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "quick_action_chips",
          chips: [
            { key: "draw", label: "抽个签" },
            { key: "bazi", label: "看八字" },
          ],
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "抽个签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "看八字" })).toBeInTheDocument();
  });

  // ============ fallback / 22 总数 ============

  it("未知 ui 回退 text bubble（不抛错）", () => {
    expect(() =>
      render(
        <MessageBubble message={assistantMsg({ ui: "unknown_x" }, "fallback text")} />,
      ),
    ).not.toThrow();
    expect(screen.getByText("fallback text")).toBeInTheDocument();
  });

  it("空 metadata → text bubble", () => {
    render(
      <MessageBubble
        message={{
          id: "m",
          role: "assistant",
          content: "Hello",
          metadata: null,
          created_at: "2026-04-27T10:00:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("user 角色 → 强制 text bubble (右对齐，不走 dispatch)", () => {
    render(
      <MessageBubble
        message={{
          id: "u",
          role: "user",
          content: "我想抽签",
          metadata: JSON.stringify({ ui: "intent_pending" }),
          created_at: "2026-04-27T10:00:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("我想抽签")).toBeInTheDocument();
    expect(screen.queryByText("正在识别意图…")).toBeNull();
  });
});

describe("MessageBubble (M2.14 — callback 注入)", () => {
  it("choice_card 点击 → onCardPick(msgId, ui, key)", () => {
    const onCardPick = vi.fn();
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "choice_card",
          options: [{ key: "a", label: "选项A" }],
        })}
        onCardPick={onCardPick}
      />,
    );
    screen.getByText("选项A").closest("button")?.click();
    expect(onCardPick).toHaveBeenCalledWith("m-test", "choice_card", "a");
  });

  it("error_card retry → onCardAction(msgId, ui, 'retry')", () => {
    const onCardAction = vi.fn();
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "error_card",
          message: "AI 卡了",
          retryable: true,
        })}
        onCardAction={onCardAction}
      />,
    );
    screen.getByRole("button", { name: "重试" }).click();
    expect(onCardAction).toHaveBeenCalledWith("m-test", "error_card", "retry");
  });

  it("quick_action_chips 点击 → onCardPick(msgId, ui, chipKey)", () => {
    const onCardPick = vi.fn();
    render(
      <MessageBubble
        message={assistantMsg({
          ui: "quick_action_chips",
          chips: [{ key: "draw", label: "抽个签" }],
        })}
        onCardPick={onCardPick}
      />,
    );
    screen.getByRole("button", { name: "抽个签" }).click();
    expect(onCardPick).toHaveBeenCalledWith("m-test", "quick_action_chips", "draw");
  });
});
