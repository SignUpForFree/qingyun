/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DimensionBars7 } from "./DimensionBars7";
import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";

const SAMPLE: DimensionScores7 = {
  爱情: 75,
  财富: 80,
  事业: 78,
  学习: 70,
  健康: 72,
  人际: 76,
  心情: 74,
};

describe("DimensionBars7 (M4.2)", () => {
  it("渲染 7 个维度 label", () => {
    render(<DimensionBars7 scores={SAMPLE} />);
    for (const dim of ["爱情", "财富", "事业", "学习", "健康", "人际", "心情"]) {
      expect(screen.getByText(dim)).toBeInTheDocument();
    }
  });

  it("每个维度显示分数", () => {
    render(<DimensionBars7 scores={SAMPLE} />);
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
  });

  it("bar width 跟随分数（百分比）", () => {
    const { container } = render(<DimensionBars7 scores={SAMPLE} />);
    const aiqingBar = container.querySelector('[data-testid="bar-爱情"]') as HTMLElement;
    expect(aiqingBar.style.width).toBe("75%");
  });

  it("分数 > 100 截到 100；< 0 截到 0", () => {
    const extreme: DimensionScores7 = {
      爱情: 999,
      财富: -50,
      事业: 50,
      学习: 50,
      健康: 50,
      人际: 50,
      心情: 50,
    };
    const { container } = render(<DimensionBars7 scores={extreme} />);
    const high = container.querySelector('[data-testid="bar-爱情"]') as HTMLElement;
    const low = container.querySelector('[data-testid="bar-财富"]') as HTMLElement;
    expect(high.style.width).toBe("100%");
    expect(low.style.width).toBe("0%");
  });

  it("自定义 order 改变渲染顺序", () => {
    render(<DimensionBars7 scores={SAMPLE} order={["心情", "爱情"]} />);
    const labels = screen.getAllByText(/^(心情|爱情)$/);
    expect(labels[0]).toHaveTextContent("心情");
    expect(labels[1]).toHaveTextContent("爱情");
  });
});
