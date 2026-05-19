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

const MOCK_SECTIONS = [
  { emoji: "💰", label: "财运", shortReading: "正财旺盛，收入稳定。", longReading: "一分耕耘一分收获。" },
  { emoji: "✨", label: "福小运寄语", shortReading: "守得住财运，福气更长久。", longReading: "" },
];

describe("SlipReportCard", () => {
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

  it("无 sections → 解签词 + AI 解读纯文本展示", () => {
    render(<SlipReportCard {...baseProps} />);
    expect(screen.getByText("解 签 词")).toBeInTheDocument();
    expect(screen.getByText("AI 解 读")).toBeInTheDocument();
    expect(screen.getByText(/此签遇合有时/)).toBeInTheDocument();
    expect(screen.getByText(/工作上有贵人助力/)).toBeInTheDocument();
  });

  it("有 sections → 分段展示", () => {
    render(<SlipReportCard {...baseProps} sections={MOCK_SECTIONS} />);
    expect(screen.getByTestId("slip-sections")).toBeInTheDocument();
    expect(screen.getByText("财运")).toBeInTheDocument();
    expect(screen.getByText("福小运寄语")).toBeInTheDocument();
    expect(screen.getByText("正财旺盛，收入稳定。")).toBeInTheDocument();
    expect(screen.getByText("一分耕耘一分收获。")).toBeInTheDocument();
    // 不显示旧的 "AI 解 读" 标签
    expect(screen.queryByText("AI 解 读")).toBeNull();
  });

  it("isFullInterpret=false + onFullExplain → 显示'我要完整解读'按钮", () => {
    const onFullExplain = vi.fn();
    render(
      <SlipReportCard
        {...baseProps}
        sections={MOCK_SECTIONS}
        isFullInterpret={false}
        onFullExplain={onFullExplain}
      />,
    );
    const btn = screen.getByTestId("btn-full-explain");
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onFullExplain).toHaveBeenCalledOnce();
  });

  it("isFullInterpret=true → 不显示'我要完整解读'按钮", () => {
    const onFullExplain = vi.fn();
    render(
      <SlipReportCard
        {...baseProps}
        sections={MOCK_SECTIONS}
        isFullInterpret={true}
        onFullExplain={onFullExplain}
      />,
    );
    expect(screen.queryByTestId("btn-full-explain")).toBeNull();
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
    ["吉", "吉 签"],
    ["平", "平 签"],
    ["渐顺", "渐 顺 签"],
    ["慎行", "慎 行 签"],
  ] as const)("level=%s 渲染 '%s'", (level, label) => {
    render(<SlipReportCard {...baseProps} level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("右下角红朱方框印章（落款 福小运）", () => {
    render(<SlipReportCard {...baseProps} />);
    const seal = screen.getByTestId("report-seal");
    expect(seal).toHaveTextContent("福");
    expect(seal).toHaveTextContent("小");
    expect(seal).toHaveTextContent("运");
  });
});
