import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProgressLongTaskCard } from "./ProgressLongTaskCard";

describe("ProgressLongTaskCard (M2.8)", () => {
  it("默认渲染 stage label '推算中…' + 不定进度条 (aria-busy)", () => {
    render(<ProgressLongTaskCard />);
    expect(screen.getByText("推算中…")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-busy")).toBe("true");
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
  });

  it("stage='streaming' 渲染 'AI 正在解读…'", () => {
    render(<ProgressLongTaskCard stage="streaming" />);
    expect(screen.getByText("AI 正在解读…")).toBeInTheDocument();
  });

  it("stage='classifying' 渲染 '识别意图…'", () => {
    render(<ProgressLongTaskCard stage="classifying" />);
    expect(screen.getByText("识别意图…")).toBeInTheDocument();
  });

  it("etaSec 渲染 '约 30s'", () => {
    render(<ProgressLongTaskCard etaSec={30} />);
    expect(screen.getByText("约 30s")).toBeInTheDocument();
  });

  it("etaSec=0 不渲染（避免显示 '约 0s'）", () => {
    render(<ProgressLongTaskCard etaSec={0} />);
    expect(screen.queryByText(/约 \d+s/)).toBeNull();
  });

  it("percent=45 进度条 aria-valuenow=45 + 无 aria-busy", () => {
    render(<ProgressLongTaskCard percent={45} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("45");
    expect(bar.getAttribute("aria-busy")).toBeNull();
  });

  it("percent 越界自动 clamp [0,100]", () => {
    const { rerender } = render(<ProgressLongTaskCard percent={150} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    rerender(<ProgressLongTaskCard percent={-20} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("提供 onCancel 时渲染 '取消' 按钮并触发回调", () => {
    const onCancel = vi.fn();
    render(<ProgressLongTaskCard onCancel={onCancel} />);
    const btn = screen.getByRole("button", { name: "取消" });
    fireEvent.click(btn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("不提供 onCancel 时不渲染 '取消'", () => {
    render(<ProgressLongTaskCard />);
    expect(screen.queryByRole("button", { name: "取消" })).toBeNull();
  });

  it("cancellable=false 即使提供 onCancel 也隐藏取消按钮", () => {
    const onCancel = vi.fn();
    render(<ProgressLongTaskCard onCancel={onCancel} cancellable={false} />);
    expect(screen.queryByRole("button", { name: "取消" })).toBeNull();
  });

  it("综合：plan 示例 etaSec=30 stage=streaming percent=45 onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ProgressLongTaskCard
        etaSec={30}
        stage="streaming"
        percent={45}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("45");
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });
});
