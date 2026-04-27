/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LauncherGrid } from "./LauncherGrid";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("LauncherGrid (M4.3)", () => {
  it("渲染 4 个入口 label", () => {
    render(<LauncherGrid />);
    for (const label of ["抽签", "解梦", "八字", "测算"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("各入口 href 指向 /chat?intent=<intent>", () => {
    render(<LauncherGrid />);
    const cases: Array<[string, string]> = [
      ["divination", "/chat?intent=divination"],
      ["dream", "/chat?intent=dream"],
      ["bazi", "/chat?intent=bazi"],
      ["meihua", "/chat?intent=meihua"],
    ];
    for (const [intent, href] of cases) {
      const a = screen.getByTestId(`launcher-${intent}`);
      expect(a).toHaveAttribute("href", href);
    }
  });

  it("4 列 grid 布局", () => {
    const { container } = render(<LauncherGrid />);
    const grid = container.querySelector('[data-testid="launcher-grid"]');
    expect(grid?.className).toContain("grid-cols-4");
  });

  // ============ M4.27 自画 SVG icon ============

  it("4 launcher 渲染对应 FunctionIcon SVG（替换 V1 单字 emoji）", () => {
    render(<LauncherGrid />);
    expect(screen.getByTestId("fn-icon-divination")).toBeInTheDocument();
    expect(screen.getByTestId("fn-icon-dream")).toBeInTheDocument();
    expect(screen.getByTestId("fn-icon-bazi")).toBeInTheDocument();
    expect(screen.getByTestId("fn-icon-meihua")).toBeInTheDocument();
  });
});
