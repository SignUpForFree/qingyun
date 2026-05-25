import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeihuaResultCard } from "./MeihuaResultCard";

const view = (n: number, name: string, upper: string, lower: string) => ({
  number: n,
  name,
  upper,
  lower,
});

const baseProps = {
  ben: view(1, "乾为天", "乾", "乾"),
  hu: view(43, "泽天夬", "兑", "乾"),
  bian: view(13, "天火同人", "乾", "离"),
  dongYao: 3,
  ti: "乾",
  yong: "兑",
  relation: "yong_sheng_ti",
  verdict: "大吉",
  speed: "fast" as const,
  timeHint: "三日内",
  branchHour: "卯时",
};

describe("MeihuaResultCard (M2.13)", () => {
  it("渲染 verdict 大吉 chip", () => {
    render(<MeihuaResultCard {...baseProps} />);
    expect(screen.getByText("大吉")).toBeInTheDocument();
  });

  it("渲染 3 卦标签：本/互/变", () => {
    render(<MeihuaResultCard {...baseProps} />);
    expect(screen.getByText("本 卦")).toBeInTheDocument();
    expect(screen.getByText("互 卦")).toBeInTheDocument();
    expect(screen.getByText("变 卦")).toBeInTheDocument();
    expect(screen.queryByText("卦 中 卦")).not.toBeInTheDocument();
  });

  it("渲染 3 卦名", () => {
    render(<MeihuaResultCard {...baseProps} />);
    expect(screen.getByText("乾为天")).toBeInTheDocument();
    expect(screen.getByText("泽天夬")).toBeInTheDocument();
    expect(screen.getByText("天火同人")).toBeInTheDocument();
  });

  it("渲染体用 + 五行注释", () => {
    render(<MeihuaResultCard {...baseProps} />);
    const elContent = document.body.textContent ?? "";
    expect(elContent).toContain("体");
    expect(elContent).toContain("用");
    expect(elContent).toContain("乾");
    expect(elContent).toContain("兑");
  });

  it("渲染动爻 + 应期 + 时辰（动爻数字 → 中文）", () => {
    render(<MeihuaResultCard {...baseProps} />);
    const text = document.body.textContent ?? "";
    // dongYao=3 → "三" 爻
    expect(text).toContain("第 三 爻");
    expect(text).toContain("三日内");
    expect(text).toContain("卯时");
  });

  it("branchHour=null 不渲染时辰", () => {
    render(<MeihuaResultCard {...baseProps} branchHour={null} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("卯时");
    expect(text).toContain("三日内");
  });
});
