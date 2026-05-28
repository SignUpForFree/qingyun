import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "./ChatInput";
import { CHAT_SEND_BLOCKED_WHILE_GENERATING } from "./chat-input-messages";

vi.mock("sonner", () => ({
  toast: { message: vi.fn(), error: vi.fn() },
}));

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(onSend).toHaveBeenCalledWith("我要解梦");
  });

  it("generating 时 textarea 可输入，chip 拦截并 toast", async () => {
    const onSend = vi.fn();
    const { toast } = await import("sonner");
    render(<ChatInput onSend={onSend} showQuickChips generating onStop={vi.fn()} />);
    const ta = screen.getByPlaceholderText("把想问的写给我…");
    expect(ta).not.toBeDisabled();
    fireEvent.change(ta, { target: { value: "草稿" } });
    expect((ta as HTMLTextAreaElement).value).toBe("草稿");

    const chip = screen.getByRole("button", { name: "抽灵签" });
    expect(chip).not.toBeDisabled();
    fireEvent.click(chip);
    expect(onSend).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalledWith(CHAT_SEND_BLOCKED_WHILE_GENERATING);
  });

  it("generating 时 Enter / 发送钮 拦截并 toast", async () => {
    const onSend = vi.fn();
    const { toast } = await import("sonner");
    render(<ChatInput onSend={onSend} generating onStop={vi.fn()} />);
    const ta = screen.getByPlaceholderText("把想问的写给我…");
    fireEvent.change(ta, { target: { value: "你好" } });
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalledWith(CHAT_SEND_BLOCKED_WHILE_GENERATING);

    vi.clearAllMocks();
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(onSend).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalledWith(CHAT_SEND_BLOCKED_WHILE_GENERATING);
  });

  it("generating 时展示停止按钮并触发 onStop", () => {
    const onStop = vi.fn();
    render(<ChatInput onSend={vi.fn()} generating onStop={onStop} />);
    fireEvent.click(screen.getByTestId("chat-stop-generation"));
    expect(onStop).toHaveBeenCalledTimes(1);
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
