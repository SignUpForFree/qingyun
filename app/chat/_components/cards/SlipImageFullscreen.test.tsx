import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlipImageFullscreen } from "./SlipImageFullscreen";

const baseProps = {
  slipNumber: 1,
  level: "上上" as const,
  title: "天官赐福",
  poemLines: ["平生学道未尝闲", "鼓吹欢呼柳影间", "今日相逢欢自喜", "明朝富贵亦悠然"],
  imageUrl: "/api/divination/slip-image/1",
};

describe("SlipImageFullscreen (M2.11)", () => {
  it("渲染签图 + 立即解读按钮（plan 示例）", () => {
    render(<SlipImageFullscreen {...baseProps} onExplain={() => {}} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/api/divination/slip-image/1");
    expect(screen.getByRole("button", { name: "立即解读" })).toBeInTheDocument();
  });

  it("渲染 level 徽章 + 签号 + 标题", () => {
    render(<SlipImageFullscreen {...baseProps} onExplain={() => {}} />);
    expect(screen.getByText("上 上 签")).toBeInTheDocument();
    expect(screen.getByText(/第 1 签/)).toBeInTheDocument();
    expect(screen.getByText(/天官赐福/)).toBeInTheDocument();
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

  it("category 提供时渲染 '关于 · {category}'", () => {
    render(
      <SlipImageFullscreen
        {...baseProps}
        category="事业学业"
        onExplain={() => {}}
      />,
    );
    expect(screen.getByText("事业学业")).toBeInTheDocument();
  });

  it("busy=true 时按钮 disabled 不触发回调", () => {
    const onExplain = vi.fn();
    render(<SlipImageFullscreen {...baseProps} onExplain={onExplain} busy />);
    const btn = screen.getByRole("button", { name: "立即解读" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onExplain).not.toHaveBeenCalled();
  });

  it.each([
    ["上上", "上 上 签"],
    ["上吉", "上 吉 签"],
    ["中吉", "中 吉 签"],
    ["中平", "中 平 签"],
    ["下下", "下 下 签"],
  ] as const)("level=%s 渲染徽章 '%s'", (level, label) => {
    render(<SlipImageFullscreen {...baseProps} level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
