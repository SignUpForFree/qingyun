import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DreamResultCard } from "./DreamResultCard";

describe("DreamResultCard (M2.13)", () => {
  it("mode='fast' 渲染 '快 速 解 梦' 标签", () => {
    render(<DreamResultCard mode="fast" aiText="快速解读" />);
    expect(screen.getByText("快 速 解 梦")).toBeInTheDocument();
    expect(screen.getByText("快速解读")).toBeInTheDocument();
  });

  it("mode='precise' 渲染 '精 准 解 梦' 标签", () => {
    render(<DreamResultCard mode="precise" aiText="精准解读" />);
    expect(screen.getByText("精 准 解 梦")).toBeInTheDocument();
    expect(screen.getByText("精准解读")).toBeInTheDocument();
  });

  it("AI 文本保留换行", () => {
    const txt = "周公视角\n\n现代心理学";
    render(<DreamResultCard mode="precise" aiText={txt} />);
    const p = screen.getByText(/周公视角/);
    expect(p.textContent).toContain("现代心理学");
  });

  it("两种 mode 视觉区分（chip 背景类）", () => {
    const { container: a } = render(<DreamResultCard mode="fast" aiText="x" />);
    const { container: b } = render(<DreamResultCard mode="precise" aiText="x" />);
    // 两种 mode 应有不同 chip 背景类
    const fastChip = a.querySelector("span");
    const preciseChip = b.querySelector("span");
    expect(fastChip?.className).not.toBe(preciseChip?.className);
  });
});
