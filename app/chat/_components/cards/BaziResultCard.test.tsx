import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BaziResultCard } from "./BaziResultCard";

const baseChart = {
  pillars: {
    year: { gan: "甲" as const, zhi: "子" as const },
    month: { gan: "乙" as const, zhi: "丑" as const },
    day: { gan: "丙" as const, zhi: "寅" as const },
    hour: { gan: "丁" as const, zhi: "卯" as const },
  },
  fiveElements: { 金: 1, 木: 3, 水: 2, 火: 1, 土: 1 } as const,
  dayMaster: "丙",
  tenGods: { year: "正官" as const, month: "偏财" as const, hour: "比肩" as const },
  currentLuck: "戊辰",
};

describe("BaziResultCard (design §8)", () => {
  it("渲染 命 盘 标题 + 4 柱区块（year/month/day/hour）", () => {
    render(
      <BaziResultCard chart={baseChart} focus="事业学业" aiText="您日主丙火生于子月..." />,
    );
    expect(screen.getByText("命 盘")).toBeInTheDocument();
    for (const k of ["year", "month", "day", "hour"]) {
      expect(screen.getByTestId(`bazi-pillar-${k}`)).toBeInTheDocument();
    }
  });

  it("4 柱里干支拆开渲染", () => {
    render(<BaziResultCard chart={baseChart} focus="x" aiText="y" />);
    const yearCell = screen.getByTestId("bazi-pillar-year");
    expect(yearCell.textContent).toContain("甲");
    expect(yearCell.textContent).toContain("子");
    expect(yearCell.textContent).toContain("年 柱");
    expect(yearCell.textContent).toContain("正官");
  });

  it("日柱标 日 主 而非十神", () => {
    render(<BaziResultCard chart={baseChart} focus="x" aiText="y" />);
    const dayCell = screen.getByTestId("bazi-pillar-day");
    expect(dayCell.textContent).toContain("日 主");
  });

  it("五行 stack bar + 5 个 label", () => {
    render(<BaziResultCard chart={baseChart} focus="x" aiText="y" />);
    const fe = screen.getByTestId("bazi-fiveelements");
    for (const w of ["金", "木", "水", "火", "土"]) {
      expect(fe.textContent).toContain(w);
    }
    // count 数字
    expect(fe.textContent).toMatch(/3/); // 木 3
  });

  it("无 favorableGods → 显示当前大运 fallback", () => {
    render(<BaziResultCard chart={baseChart} focus="x" aiText="y" />);
    expect(screen.getByText(/当 前 大 运/)).toBeInTheDocument();
    expect(screen.getByText(/戊辰/)).toBeInTheDocument();
  });

  it("有 favorableGods → 替代大运行渲染喜用神", () => {
    render(
      <BaziResultCard
        chart={{ ...baseChart, favorableGods: ["火", "木"] }}
        focus="x"
        aiText="y"
      />,
    );
    expect(screen.getByText(/喜 用 神/)).toBeInTheDocument();
    expect(screen.getByText(/火、木/)).toBeInTheDocument();
    expect(screen.queryByText(/当 前 大 运/)).toBeNull();
  });

  it("AI 文本含段首 ✦ + 保留换行", () => {
    const multiline = "第一段\n\n第二段";
    render(<BaziResultCard chart={baseChart} focus="x" aiText={multiline} />);
    const p = screen.getByText(/第一段/);
    expect(p.textContent).toContain("第二段");
  });

  it("有 ownerLabel + birthSummary → 副标题渲染", () => {
    render(
      <BaziResultCard
        chart={baseChart}
        focus="综合"
        aiText="x"
        ownerLabel="任亮"
        birthSummary="丁丑年 三月初七 辰时"
      />,
    );
    expect(screen.getByText(/任亮/)).toBeInTheDocument();
    expect(screen.getByText(/丁丑年 三月初七/)).toBeInTheDocument();
  });

  it("提供 onExplain → 渲染 CTA 按钮", () => {
    const onExplain = vi.fn();
    render(
      <BaziResultCard chart={baseChart} focus="x" aiText="y" onExplain={onExplain} />,
    );
    const cta = screen.getByTestId("bazi-explain-cta");
    expect(cta.textContent).toMatch(/读.*细.*说.*命.*盘/);
    fireEvent.click(cta);
    expect(onExplain).toHaveBeenCalledTimes(1);
  });

  it("不提供 onExplain → 不渲染 CTA", () => {
    render(<BaziResultCard chart={baseChart} focus="x" aiText="y" />);
    expect(screen.queryByTestId("bazi-explain-cta")).toBeNull();
  });
});
