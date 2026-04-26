import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntentChips } from "./IntentChips";

describe("IntentChips", () => {
  it("渲染 4 chip", () => {
    render(<IntentChips onPick={() => {}} />);
    expect(screen.getByRole("button", { name: "抽灵签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "测算" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 解梦" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "八字解读" })).toBeInTheDocument();
  });

  it("点 chip 触发 onPick(固定话术)", () => {
    const onPick = vi.fn();
    render(<IntentChips onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "抽灵签" }));
    expect(onPick).toHaveBeenCalledWith("我要抽灵签");
    fireEvent.click(screen.getByRole("button", { name: "测算" }));
    expect(onPick).toHaveBeenCalledWith("我要测算");
    fireEvent.click(screen.getByRole("button", { name: "AI 解梦" }));
    expect(onPick).toHaveBeenCalledWith("我要 AI 解梦");
    fireEvent.click(screen.getByRole("button", { name: "八字解读" }));
    expect(onPick).toHaveBeenCalledWith("我要八字解读");
  });

  it("busy 时禁用", () => {
    const onPick = vi.fn();
    render(<IntentChips onPick={onPick} busy />);
    const btn = screen.getByRole("button", { name: "抽灵签" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onPick).not.toHaveBeenCalled();
  });
});
