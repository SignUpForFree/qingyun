import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlipReportCard } from "./SlipReportCard";

const baseProps = {
  slipNumber: 42,
  level: "上吉" as const,
  title: "渔翁得利",
  poem: "平生学道未尝闲\n鼓吹欢呼柳影间\n今日相逢欢自喜\n明朝富贵亦悠然",
  dimension: "事业学业",
  reading: "此签遇合有时，得意自然之机也。",
  aiInterpretation: "结合您的八字日主和最近问询，工作上有贵人助力，但需注意细节。",
};

describe("SlipReportCard (M2.12)", () => {
  it("渲染 level 徽章 + 签号 + 标题", () => {
    render(<SlipReportCard {...baseProps} />);
    expect(screen.getByText("上 吉 签")).toBeInTheDocument();
    expect(screen.getByText(/第 42 签/)).toBeInTheDocument();
    expect(screen.getByText(/渔翁得利/)).toBeInTheDocument();
  });

  it("渲染 dimension 标签", () => {
    render(<SlipReportCard {...baseProps} />);
    expect(screen.getByText("事业学业")).toBeInTheDocument();
  });

  it("渲染签诗（保留换行）", () => {
    render(<SlipReportCard {...baseProps} />);
    const poemEl = screen.getByText(/平生学道未尝闲/);
    expect(poemEl).toBeInTheDocument();
    expect(poemEl.textContent).toContain("明朝富贵亦悠然");
  });

  it("解签词 + AI 解读分别独立展示", () => {
    render(<SlipReportCard {...baseProps} />);
    expect(screen.getByText("解 签 词")).toBeInTheDocument();
    expect(screen.getByText("AI 解 读")).toBeInTheDocument();
    expect(screen.getByText(/此签遇合有时/)).toBeInTheDocument();
    expect(screen.getByText(/工作上有贵人助力/)).toBeInTheDocument();
  });

  it("无 onShare 时不渲染分享按钮", () => {
    render(<SlipReportCard {...baseProps} />);
    expect(screen.queryByRole("button", { name: "分享报告" })).toBeNull();
  });

  it("提供 onShare → 渲染分享按钮 + 触发回调", () => {
    const onShare = vi.fn();
    render(<SlipReportCard {...baseProps} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: "分享报告" }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it.each([
    ["上上", "上 上 签"],
    ["上吉", "上 吉 签"],
    ["中吉", "中 吉 签"],
    ["中平", "中 平 签"],
    ["下下", "下 下 签"],
  ] as const)("level=%s 渲染 '%s'", (level, label) => {
    render(<SlipReportCard {...baseProps} level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  // ============ M4.23 仪式特化 ============

  it("题目用红朱色（书法风 — M4.29 calligraphy 优先 + serif 回退）", () => {
    render(<SlipReportCard {...baseProps} />);
    const title = screen.getByTestId("report-title");
    expect(title.className).toContain("text-[#7d2f2f]");
    expect(title.className).toContain("var(--font-calligraphy)");
    expect(title.className).toContain("var(--font-serif)");
  });

  it("整卡米黄渐变背景（仪式特化）", () => {
    render(<SlipReportCard {...baseProps} />);
    const card = screen.getByTestId("slip-report-card");
    // jsdom 把 hex 转 rgb：#FFF8E8 → rgb(255, 248, 232)
    expect(card.style.background).toContain("rgb(255, 248, 232)");
  });

  it("右下角红朱方框印章（落款 轻运）", () => {
    render(<SlipReportCard {...baseProps} />);
    const seal = screen.getByTestId("report-seal");
    expect(seal).toHaveTextContent("轻");
    expect(seal).toHaveTextContent("运");
  });
});
