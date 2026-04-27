import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChoiceCard } from "./ChoiceCard";
import { CardMetaSchema } from "@/types/chat-ui";

describe("ChoiceCard", () => {
  it("渲染 title + 所有 options", () => {
    render(
      <ChoiceCard
        title="您想快速还是精准解梦？"
        options={[
          { key: "fast", label: "快速解梦", hint: "简单描述" },
          { key: "precise", label: "精准解梦", hint: "多维度场景" },
        ]}
        onPick={() => {}}
      />,
    );
    expect(screen.getByText("您想快速还是精准解梦？")).toBeInTheDocument();
    expect(screen.getByText("快速解梦")).toBeInTheDocument();
    expect(screen.getByText("精准解梦")).toBeInTheDocument();
    expect(screen.getByText("简单描述")).toBeInTheDocument();
  });

  it("点选项触发 onPick(key)", () => {
    const onPick = vi.fn();
    render(
      <ChoiceCard
        title="t"
        options={[
          { key: "a", label: "选 A" },
          { key: "b", label: "选 B" },
        ]}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /选 A/ }));
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("busy 时按钮 disabled", () => {
    const onPick = vi.fn();
    render(
      <ChoiceCard title="t" options={[{ key: "a", label: "选 A" }]} onPick={onPick} busy />,
    );
    const btn = screen.getByRole("button", { name: /选 A/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("M2.5: 从 choice_card CardMeta 渲染（schema 对齐 hint 字段）", () => {
    const meta = {
      ui: "choice_card" as const,
      question: "你想做哪种解读？",
      options: [
        { key: "fast", label: "快速解梦", hint: "30 秒一句话" },
        { key: "precise", label: "精准解梦", hint: "4 字段全场景" },
      ],
    };
    expect(CardMetaSchema.parse(meta).ui).toBe("choice_card");

    render(
      <ChoiceCard
        title={meta.question}
        options={meta.options}
        onPick={() => {}}
      />,
    );
    expect(screen.getByText("快速解梦")).toBeInTheDocument();
    expect(screen.getByText("30 秒一句话")).toBeInTheDocument();
    expect(screen.getByText("精准解梦")).toBeInTheDocument();
  });
});
