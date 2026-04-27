import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BaziResultCard } from "./BaziResultCard";

const baseChart = {
  pillars: {
    year: { gan: "甲" as const, zhi: "子" as const },
    month: { gan: "乙" as const, zhi: "丑" as const },
    day: { gan: "丙" as const, zhi: "寅" as const },
    hour: { gan: "丁" as const, zhi: "卯" as const },
  },
  fiveElements: { 金: 1, 木: 3, 水: 2, 火: 1, 土: 1 },
  dayMaster: "丙",
  tenGods: { year: "正官" as const, month: "偏财" as const, hour: "比肩" as const },
  currentLuck: "戊辰",
};

describe("BaziResultCard (M2.13)", () => {
  it("渲染 4 柱（年/月/日/时）+ focus + AI 文本", () => {
    render(
      <BaziResultCard chart={baseChart} focus="事业学业" aiText="您日主丙火生于子月..." />,
    );
    expect(screen.getByText(/八字 · 事业学业/)).toBeInTheDocument();
    expect(screen.getByText("甲子")).toBeInTheDocument();
    expect(screen.getByText("乙丑")).toBeInTheDocument();
    expect(screen.getByText("丙寅")).toBeInTheDocument();
    expect(screen.getByText("丁卯")).toBeInTheDocument();
    expect(screen.getByText(/您日主丙火生于子月/)).toBeInTheDocument();
  });

  it("渲染 5 行五行计数", () => {
    render(<BaziResultCard chart={baseChart} focus="财运" aiText="x" />);
    expect(screen.getByText(/金 1/)).toBeInTheDocument();
    expect(screen.getByText(/木 3/)).toBeInTheDocument();
    expect(screen.getByText(/水 2/)).toBeInTheDocument();
    expect(screen.getByText(/火 1/)).toBeInTheDocument();
    expect(screen.getByText(/土 1/)).toBeInTheDocument();
  });

  it("渲染日主 + 当前大运", () => {
    render(<BaziResultCard chart={baseChart} focus="x" aiText="y" />);
    expect(screen.getByText("丙")).toBeInTheDocument();
    expect(screen.getByText(/戊辰/)).toBeInTheDocument();
  });

  it("AI 文本保留换行 (whitespace-pre-wrap)", () => {
    const multiline = "第一段\n\n第二段";
    render(<BaziResultCard chart={baseChart} focus="x" aiText={multiline} />);
    const p = screen.getByText(/第一段/);
    expect(p.textContent).toContain("第二段");
  });
});
