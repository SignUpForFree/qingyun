import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DreamPreciseModal } from "./DreamPreciseModal";

describe("DreamPreciseModal (M2.10)", () => {
  it("open=false 不渲染（null）", () => {
    const { container } = render(
      <DreamPreciseModal open={false} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("open=true 渲染 4 个 textarea + 提交按钮", () => {
    render(<DreamPreciseModal open onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("核心场景")).toBeInTheDocument();
    expect(screen.getByLabelText("情绪感受")).toBeInTheDocument();
    expect(screen.getByLabelText("现实关联")).toBeInTheDocument();
    expect(screen.getByLabelText("特殊符号")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "精准解梦" })).toBeInTheDocument();
  });

  it("提交 4 字段（plan 示例）", () => {
    const onSubmit = vi.fn();
    render(<DreamPreciseModal open onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("核心场景"), { target: { value: "梦见考试" } });
    fireEvent.change(screen.getByLabelText("情绪感受"), { target: { value: "紧张" } });
    fireEvent.click(screen.getByRole("button", { name: "精准解梦" }));
    expect(onSubmit).toHaveBeenCalledWith({
      core: "梦见考试",
      emotion: "紧张",
      reality: "",
      special: "",
    });
  });

  it("缺 core 时点提交不调 onSubmit + 显示错误提示", () => {
    const onSubmit = vi.fn();
    render(<DreamPreciseModal open onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("情绪感受"), { target: { value: "紧张" } });
    fireEvent.click(screen.getByRole("button", { name: "精准解梦" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("请填写核心场景")).toBeInTheDocument();
  });

  it("缺 emotion 时点提交不调 onSubmit + 显示错误提示", () => {
    const onSubmit = vi.fn();
    render(<DreamPreciseModal open onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("核心场景"), { target: { value: "考试" } });
    fireEvent.click(screen.getByRole("button", { name: "精准解梦" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("请填写情绪感受")).toBeInTheDocument();
  });

  it("初次进入不显示错误（避免 hostile UI）", () => {
    render(<DreamPreciseModal open onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(/请填写/)).toBeNull();
  });

  it("点击关闭按钮调 onClose", () => {
    const onClose = vi.fn();
    render(<DreamPreciseModal open onSubmit={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("busy=true 时所有 textarea + submit 按钮 disabled", () => {
    render(<DreamPreciseModal open busy onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("核心场景")).toBeDisabled();
    expect(screen.getByLabelText("情绪感受")).toBeDisabled();
    expect(screen.getByRole("button", { name: "精准解梦" })).toBeDisabled();
  });

  it("提交完整 4 字段（含 reality / special）", () => {
    const onSubmit = vi.fn();
    render(<DreamPreciseModal open onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("核心场景"), { target: { value: "梦见水" } });
    fireEvent.change(screen.getByLabelText("情绪感受"), { target: { value: "平静" } });
    fireEvent.change(screen.getByLabelText("现实关联"), { target: { value: "明天搬家" } });
    fireEvent.change(screen.getByLabelText("特殊符号"), { target: { value: "数字 8" } });
    fireEvent.click(screen.getByRole("button", { name: "精准解梦" }));
    expect(onSubmit).toHaveBeenCalledWith({
      core: "梦见水",
      emotion: "平静",
      reality: "明天搬家",
      special: "数字 8",
    });
  });

  it("close 后再 open 应重置表单状态（避免下次打开还有上次输入）", () => {
    const { rerender } = render(
      <DreamPreciseModal open onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("核心场景"), { target: { value: "x" } });
    rerender(<DreamPreciseModal open={false} onSubmit={vi.fn()} onClose={vi.fn()} />);
    rerender(<DreamPreciseModal open onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect((screen.getByLabelText("核心场景") as HTMLTextAreaElement).value).toBe("");
  });

  it("initialData 提供时预填表单", () => {
    render(
      <DreamPreciseModal
        open
        onSubmit={vi.fn()}
        onClose={vi.fn()}
        initialData={{ core: "已有内容" }}
      />,
    );
    expect((screen.getByLabelText("核心场景") as HTMLTextAreaElement).value).toBe("已有内容");
  });

  it("aria-modal=true + role=dialog + aria-label", () => {
    render(<DreamPreciseModal open onSubmit={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("精准解梦");
  });
});
