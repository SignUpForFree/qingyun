import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlipImageFullscreen } from "./SlipImageFullscreen";
import { SLIP_LAYOUT_VERSION } from "@/lib/divination/slip-image-url";

const baseProps = {
  slipNumber: 1,
  level: "上上" as const,
  title: "天官赐福",
  poemLines: ["平生学道未尝闲", "鼓吹欢呼柳影间", "今日相逢欢自喜", "明朝富贵亦悠然"],
  imageUrl: "/api/divination/slip-image/1",
};

const withLayout = (url: string) =>
  url.includes("layout=")
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}layout=${SLIP_LAYOUT_VERSION}`;

describe("SlipImageFullscreen (M2.11)", () => {
  it("渲染签图 + 立即解读按钮（plan 示例）", () => {
    render(<SlipImageFullscreen {...baseProps} onExplain={() => {}} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe(withLayout("/api/divination/slip-image/1"));
    expect(screen.getByRole("button", { name: "立即解读" })).toBeInTheDocument();
    expect(screen.getByText("轻触放大")).toBeInTheDocument();
  });

  it("已有 layout 参数的 imageUrl 不再重复追加", () => {
    const url = "/api/divination/slip-image/1?layout=3&category=事业";
    render(
      <SlipImageFullscreen {...baseProps} imageUrl={url} onExplain={() => {}} />,
    );
    expect(screen.getByRole("img").getAttribute("src")).toBe(url);
  });

  it("img 加载失败 → 回退渲染 4 行签诗", () => {
    render(<SlipImageFullscreen {...baseProps} onExplain={() => {}} />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(screen.getByText("平生学道未尝闲")).toBeInTheDocument();
    expect(screen.getByText("鼓吹欢呼柳影间")).toBeInTheDocument();
    expect(screen.getByText("今日相逢欢自喜")).toBeInTheDocument();
    expect(screen.getByText("明朝富贵亦悠然")).toBeInTheDocument();
  });

  it("立即解读点击触发 onExplain", () => {
    const onExplain = vi.fn();
    render(<SlipImageFullscreen {...baseProps} onExplain={onExplain} />);
    fireEvent.click(screen.getByRole("button", { name: "立即解读" }));
    expect(onExplain).toHaveBeenCalledOnce();
  });

  it("提供 onShare 时渲染 '保存到相册' 按钮", () => {
    const onShare = vi.fn();
    render(<SlipImageFullscreen {...baseProps} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: "保存到相册" }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it("不提供 onExplain / onShare 时不渲染对应按钮", () => {
    render(<SlipImageFullscreen {...baseProps} />);
    expect(screen.queryByRole("button", { name: "立即解读" })).toBeNull();
    expect(screen.queryByRole("button", { name: "保存到相册" })).toBeNull();
  });

  it("category 传入时供全屏 overlay 使用（卡面不重复展示维度）", () => {
    render(
      <SlipImageFullscreen
        {...baseProps}
        category="事业学业"
        onExplain={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /查看第 1 签大图/ }));
    expect(screen.getByText(/关 于 · 事业学业/)).toBeInTheDocument();
  });

  it("busy=true 时按钮 disabled 不触发回调", () => {
    const onExplain = vi.fn();
    render(<SlipImageFullscreen {...baseProps} onExplain={onExplain} busy />);
    const btn = screen.getByRole("button", { name: "立即解读" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onExplain).not.toHaveBeenCalled();
  });

});
