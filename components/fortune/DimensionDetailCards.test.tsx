/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DimensionDetailCards,
  parseReadingSections,
} from "./DimensionDetailCards";
import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";

const SCORES: DimensionScores7 = {
  爱情: 75,
  财富: 80,
  事业: 78,
  学习: 70,
  健康: 72,
  人际: 76,
  心情: 74,
};

const READING = `【爱情 75】今天感情运势上扬，心动信号清晰。
【财富 80】偏财稳，正财靠谱。
【事业 78】项目推进顺，沟通无障碍。
【学习 70】吸收力中等，慢一点。
【健康 72】精力够用，多喝水。
【人际 76】贵人主动靠近。
【心情 74】整体清爽，松弛感在线。`;

describe("parseReadingSections (M4.6)", () => {
  it("把 7 段 reading 切成 dim → body 映射", () => {
    const sections = parseReadingSections(READING);
    expect(sections.爱情).toContain("感情运势上扬");
    expect(sections.财富).toContain("偏财稳");
    expect(sections.事业).toContain("项目推进顺");
    expect(sections.学习).toContain("吸收力中等");
    expect(sections.健康).toContain("精力够用");
    expect(sections.人际).toContain("贵人主动靠近");
    expect(sections.心情).toContain("松弛感在线");
  });

  it("空 reading → 空 map", () => {
    expect(parseReadingSections("")).toEqual({});
  });

  it("无【】分段头时返回空 map（不崩）", () => {
    expect(parseReadingSections("纯文本无格式")).toEqual({});
  });
});

describe("DimensionDetailCards (M4.6)", () => {
  it("渲染 7 个细节卡", () => {
    render(<DimensionDetailCards scores={SCORES} reading={READING} />);
    for (const dim of ["爱情", "财富", "事业", "学习", "健康", "人际", "心情"]) {
      expect(screen.getByTestId(`detail-card-${dim}`)).toBeInTheDocument();
    }
  });

  it("每卡 60-80 字 reading body 出现", () => {
    render(<DimensionDetailCards scores={SCORES} reading={READING} />);
    expect(screen.getByText(/感情运势上扬/)).toBeInTheDocument();
    expect(screen.getByText(/偏财稳/)).toBeInTheDocument();
    expect(screen.getByText(/松弛感在线/)).toBeInTheDocument();
  });

  it("无对应段时 fallback 文案", () => {
    render(
      <DimensionDetailCards
        scores={SCORES}
        reading={`【爱情 75】只有这一段。`}
      />,
    );
    expect(screen.getAllByText(/暂时没生成/)).toHaveLength(6);
  });

  it("渲染分数", () => {
    render(<DimensionDetailCards scores={SCORES} reading={READING} />);
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  // ============ M4.27 SVG icon 复用 ============

  it("7 维度卡每张挂对应 FunctionIcon SVG", () => {
    render(<DimensionDetailCards scores={SCORES} reading={READING} />);
    // 7 dim → 7 个不同 icon
    const expected = [
      "fn-icon-love",
      "fn-icon-wealth",
      "fn-icon-career",
      "fn-icon-study",
      "fn-icon-health",
      "fn-icon-social",
      "fn-icon-mood",
    ];
    for (const id of expected) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });
});
