/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "./AppHeader";

describe("AppHeader (M4.8)", () => {
  it("title 居中渲染", () => {
    render(<AppHeader title="今日运势" />);
    expect(screen.getByText("今日运势")).toBeInTheDocument();
  });

  it("left 槽渲染（如返回 ‹）", () => {
    render(
      <AppHeader
        title="详情"
        left={<button aria-label="back">‹</button>}
      />,
    );
    expect(screen.getByLabelText("back")).toBeInTheDocument();
  });

  it("right 槽渲染（如 ☰ 历史）", () => {
    render(
      <AppHeader
        title="对话"
        right={<button aria-label="历史">☰</button>}
      />,
    );
    expect(screen.getByLabelText("历史")).toBeInTheDocument();
  });

  it("left + right 双槽并存", () => {
    render(
      <AppHeader
        title="对话"
        left={<span data-testid="L">L</span>}
        right={<span data-testid="R">R</span>}
      />,
    );
    expect(screen.getByTestId("L")).toBeInTheDocument();
    expect(screen.getByTestId("R")).toBeInTheDocument();
  });

  it("no slot → 标题独占；不抛错", () => {
    render(<AppHeader title="福小运" />);
    expect(screen.getByText("福小运")).toBeInTheDocument();
  });

  it("title 接受 ReactNode（含 Sparkle 等）", () => {
    render(<AppHeader title={<span data-testid="rich">福小运 ✨</span>} />);
    expect(screen.getByTestId("rich")).toBeInTheDocument();
  });
});
