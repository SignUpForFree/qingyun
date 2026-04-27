/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlipImageRitualOverlay } from "./SlipImageRitualOverlay";

const POEM = ["心定福自来", "莫问前程事", "云开见月明", "稳步自坦然"];

describe("SlipImageRitualOverlay (M4.22)", () => {
  it("open=false 不渲染", () => {
    render(
      <SlipImageRitualOverlay
        open={false}
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="心定福自来"
        poemLines={POEM}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByTestId("slip-image-ritual-overlay")).toBeNull();
  });

  it("open=true 渲染 dialog 角色", () => {
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="心定福自来"
        poemLines={POEM}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("slip-image-ritual-overlay")).toBeInTheDocument();
  });

  it("渲染签号 + 等级 + 签名", () => {
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={42}
        level="中吉"
        title="心定福自来"
        poemLines={POEM}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/第 42 签/)).toBeInTheDocument();
    expect(screen.getByText(/中吉/)).toBeInTheDocument();
    // 签名以《...》包裹
    expect(screen.getByText(/《心定福自来》/)).toBeInTheDocument();
  });

  it("渲染 4 句签诗", () => {
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="x"
        poemLines={POEM}
        onClose={() => {}}
      />,
    );
    for (const line of POEM) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it("category 提供时渲染", () => {
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="x"
        poemLines={POEM}
        category="事业学业"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/事业学业/)).toBeInTheDocument();
  });

  it("点击 ✕ 触发 onClose", () => {
    const onClose = vi.fn();
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="x"
        poemLines={POEM}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText("关闭"));
    expect(onClose).toHaveBeenCalled();
  });

  it("点击背景遮罩 onClose", () => {
    const onClose = vi.fn();
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="x"
        poemLines={POEM}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId("slip-image-ritual-overlay"));
    expect(onClose).toHaveBeenCalled();
  });

  it("点击内容区域 不 onClose（事件停止冒泡）", () => {
    const onClose = vi.fn();
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="x"
        poemLines={POEM}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId("ritual-overlay-img"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ESC 键 onClose", () => {
    const onClose = vi.fn();
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="x"
        poemLines={POEM}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("红朱方框印章渲染 — 落款 轻运", () => {
    render(
      <SlipImageRitualOverlay
        open
        imageUrl="/img.png"
        slipNumber={1}
        level="上上"
        title="x"
        poemLines={POEM}
        onClose={() => {}}
      />,
    );
    const seal = screen.getByTestId("ritual-seal");
    expect(seal).toHaveTextContent("轻");
    expect(seal).toHaveTextContent("运");
  });
});
