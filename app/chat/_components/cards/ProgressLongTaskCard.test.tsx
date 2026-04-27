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

  // ============ M4.24 仪式特化 ============

  it("variant 缺省 → default 容器（向后兼容）", () => {
    render(<ProgressLongTaskCard />);
    expect(screen.getByTestId("progress-long-task-default")).toBeInTheDocument();
    expect(screen.queryByTestId("progress-long-task-bazi")).toBeNull();
    expect(screen.queryByTestId("progress-long-task-meihua")).toBeNull();
  });

  it("variant='bazi' 渲染古铜金容器 + 八卦圆 SVG", () => {
    render(<ProgressLongTaskCard variant="bazi" />);
    const card = screen.getByTestId("progress-long-task-bazi");
    expect(card).toBeInTheDocument();
    // 古铜金渐变背景（jsdom 把 #2A2118 转 rgb(42, 33, 24)）
    expect(card.style.background).toContain("rgb(42, 33, 24)");
    expect(screen.getByTestId("ritual-glyph-bazi")).toBeInTheDocument();
  });

  it("variant='meihua' 渲染古铜金容器 + 六爻 SVG", () => {
    render(<ProgressLongTaskCard variant="meihua" />);
    expect(screen.getByTestId("progress-long-task-meihua")).toBeInTheDocument();
    expect(screen.getByTestId("ritual-glyph-meihua")).toBeInTheDocument();
  });

  it("bazi 八卦 SVG 含 8 条经卦标记线", () => {
    render(<ProgressLongTaskCard variant="bazi" />);
    const glyph = screen.getByTestId("ritual-glyph-bazi");
    // 8 条 line（经卦） + 2 个 circle（同心圆，与 line 不冲突）
    const lines = glyph.querySelectorAll("line");
    expect(lines.length).toBe(8);
  });

  it("meihua 六爻 SVG 含 6 行（阳爻 1 line / 阴爻 2 line）", () => {
    render(<ProgressLongTaskCard variant="meihua" />);
    const glyph = screen.getByTestId("ritual-glyph-meihua");
    // 6 爻：i % 2 === 0 阳爻 1 line（i=0,2,4 = 3 阳爻 = 3 line）
    //     i % 2 === 1 阴爻 2 line（i=1,3,5 = 3 阴爻 = 6 line）
    // 总计 3 + 6 = 9 line
    const lines = glyph.querySelectorAll("line");
    expect(lines.length).toBe(9);
  });

  it("ritual variant 也渲染 stage label + etaSec", () => {
    render(<ProgressLongTaskCard variant="bazi" stage="computing" etaSec={45} />);
    expect(screen.getByText("推算中…")).toBeInTheDocument();
    expect(screen.getByText("约 45s")).toBeInTheDocument();
  });

  it("ritual variant 进度条 percent 受控", () => {
    render(<ProgressLongTaskCard variant="meihua" percent={66} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("66");
  });

  it("ritual variant onCancel 渲染古铜金按钮", () => {
    const onCancel = vi.fn();
    render(<ProgressLongTaskCard variant="bazi" onCancel={onCancel} />);
    const btn = screen.getByRole("button", { name: "取消" });
    fireEvent.click(btn);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
