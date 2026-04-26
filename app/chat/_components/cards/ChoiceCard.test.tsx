import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChoiceCard } from "./ChoiceCard";

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
});
