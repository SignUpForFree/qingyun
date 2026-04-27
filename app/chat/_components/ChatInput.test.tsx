import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "./ChatInput";

describe("ChatInput", () => {
  it("无 chip prop → 不渲染 chip 行", () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "抽灵签" })).toBeNull();
  });

  it("showQuickChips → 渲染 4 chip", () => {
    render(<ChatInput onSend={vi.fn()} showQuickChips />);
    expect(screen.getByRole("button", { name: "抽灵签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "测算" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 解梦" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "八字解读" })).toBeInTheDocument();
  });

  it("点 chip 触发 onSend(预设话术)", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} showQuickChips />);
    fireEvent.click(screen.getByRole("button", { name: "抽灵签" }));
    expect(onSend).toHaveBeenCalledWith("我要抽灵签");
    fireEvent.click(screen.getByRole("button", { name: "AI 解梦" }));
    expect(onSend).toHaveBeenCalledWith("我要 AI 解梦");
  });

  it("busy=true 时 chip + textarea 禁用", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} showQuickChips busy />);
    const chip = screen.getByRole("button", { name: "抽灵签" });
    expect(chip).toBeDisabled();
    fireEvent.click(chip);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("AI 正在回应…")).toBeDisabled();
  });

  it("textarea 输入 + Enter 发送", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const ta = screen.getByPlaceholderText("把想问的写给我…");
    fireEvent.change(ta, { target: { value: "你好" } });
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("你好");
  });

  it("Shift+Enter 不发送（换行）", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const ta = screen.getByPlaceholderText("把想问的写给我…");
    fireEvent.change(ta, { target: { value: "你好" } });
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("空文本 + Enter 不发送", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const ta = screen.getByPlaceholderText("把想问的写给我…");
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("点击发送按钮", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    fireEvent.change(screen.getByPlaceholderText("把想问的写给我…"), {
      target: { value: "测试" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(onSend).toHaveBeenCalledWith("测试");
  });

  it("disabled=true 时全部禁用", () => {
    render(<ChatInput onSend={vi.fn()} disabled showQuickChips />);
    const ta = screen.getByPlaceholderText("把想问的写给我…");
    expect(ta).toBeDisabled();
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });

  it("initialText 预填到输入框（M4.10）", () => {
    render(<ChatInput onSend={vi.fn()} initialText="针对今日运势深入聊聊：" />);
    const ta = screen.getByPlaceholderText("把想问的写给我…") as HTMLTextAreaElement;
    expect(ta.value).toBe("针对今日运势深入聊聊：");
  });

  it("initialText 不自动 send，需用户点发送", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} initialText="预填" />);
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(onSend).toHaveBeenCalledWith("预填");
  });
});
