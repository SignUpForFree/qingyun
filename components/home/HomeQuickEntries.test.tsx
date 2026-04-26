import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeQuickEntries } from "./HomeQuickEntries";

describe("HomeQuickEntries", () => {
  it("4 入口卡渲染", () => {
    render(<HomeQuickEntries />);
    expect(screen.getByText("抽灵签")).toBeInTheDocument();
    expect(screen.getByText("测算")).toBeInTheDocument();
    expect(screen.getByText("AI 解梦")).toBeInTheDocument();
    expect(screen.getByText("AI 八字解读")).toBeInTheDocument();
  });

  it("链接跳转带 initial 参数", () => {
    render(<HomeQuickEntries />);
    const link = screen.getByText("抽灵签").closest("a");
    expect(link?.getAttribute("href")).toContain("/chat");
    expect(link?.getAttribute("href")).toContain("initial=");
    expect(link?.getAttribute("href")).toContain(encodeURIComponent("我要抽灵签"));
  });

  it("4 卡跳转 4 个 chat URL", () => {
    render(<HomeQuickEntries />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const a of links) {
      expect(a.getAttribute("href")).toMatch(/^\/chat\?initial=/);
    }
  });
});
