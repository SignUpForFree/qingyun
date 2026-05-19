import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ShakeSlipAnim } from "./ShakeSlipAnim";

describe("ShakeSlipAnim — 摇签动画", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("durationMs 后触发 onComplete", () => {
    const onComplete = vi.fn();
    render(<ShakeSlipAnim durationMs={3500} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3499);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("默认 durationMs=3500", () => {
    const onComplete = vi.fn();
    render(<ShakeSlipAnim onComplete={onComplete} />);
    vi.advanceTimersByTime(3499);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("不传 onComplete 不抛错", () => {
    expect(() => {
      render(<ShakeSlipAnim durationMs={100} />);
      vi.advanceTimersByTime(150);
    }).not.toThrow();
  });

  it("unmount 后不再触发 onComplete", () => {
    const onComplete = vi.fn();
    const { unmount } = render(<ShakeSlipAnim durationMs={1000} onComplete={onComplete} />);
    vi.advanceTimersByTime(500);
    unmount();
    vi.advanceTimersByTime(2000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("初始渲染 '摇签中…' 文案", () => {
    vi.useRealTimers();
    render(<ShakeSlipAnim durationMs={10000} />);
    expect(screen.getByText("摇签中…")).toBeInTheDocument();
    vi.useFakeTimers();
  });

  it("动画后期显示 label 文案", async () => {
    vi.useRealTimers();
    render(<ShakeSlipAnim durationMs={500} label="天意已动" />);
    // 初始阶段：摇签中…
    expect(screen.getByText("摇签中…")).toBeInTheDocument();
    // 等待进入 falling 阶段 (60% of 500ms = 300ms)
    await waitFor(() => {
      expect(screen.getByText("天意已动")).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it("status 区有 aria-live=polite", async () => {
    vi.useRealTimers();
    render(<ShakeSlipAnim durationMs={10000} />);
    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status.getAttribute("aria-live")).toBe("polite");
    });
    vi.useFakeTimers();
  });
});
