import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorCard } from "./ErrorCard";

describe("ErrorCard (M2.9)", () => {
  it("渲染 message + role=alert", () => {
    render(<ErrorCard message="AI 卡了一下，请稍后" />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("AI 卡了一下，请稍后")).toBeInTheDocument();
  });

  it("无 code 时显示默认 '提示' chip", () => {
    render(<ErrorCard message="x" />);
    expect(screen.getByText("提示")).toBeInTheDocument();
  });

  it("code='ai_timeout' chip 显示 'AI 演算超时'", () => {
    render(<ErrorCard message="x" code="ai_timeout" />);
    expect(screen.getByText("AI 演算超时")).toBeInTheDocument();
  });

  it("code='user_rate_limit' chip 显示 '用量已达上限'", () => {
    render(<ErrorCard message="x" code="user_rate_limit" />);
    expect(screen.getByText("用量已达上限")).toBeInTheDocument();
  });

  it("retryable=true + onRetry 提供 → 渲染重试按钮", () => {
    const onRetry = vi.fn();
    render(<ErrorCard message="x" retryable onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: "重试" });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("retryable=false 即使 onRetry 提供也不渲染重试", () => {
    render(<ErrorCard message="x" retryable={false} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
  });

  it("retryable 缺省时（限流场景）不渲染重试", () => {
    render(<ErrorCard message="x" onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
  });

  it("retryable=true 但 onRetry 缺省时不渲染按钮（避免无操作幽灵）", () => {
    render(<ErrorCard message="x" retryable />);
    expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
  });
});
