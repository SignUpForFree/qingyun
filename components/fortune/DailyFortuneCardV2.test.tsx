/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DailyFortuneCardV2 } from "./DailyFortuneCardV2";
import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";

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

const SCORES: DimensionScores7 = {
  爱情: 75,
  财富: 80,
  事业: 78,
  学习: 70,
  健康: 72,
  人际: 76,
  心情: 74,
};

const FORTUNE = {
  date: "2026-04-27",
  overall: 76,
  scores: SCORES,
  oneLiner: "今天像一壶刚泡开的茶。" as string | null,
  attributes: {
    color: { name: "新柳绿", hex: "#BFD9C2" },
    direction: "正东",
    hour: { branch: "辰" as const, range: "07:00–09:00" },
    number: 3,
    flower: "栀子",
    item: "一卷书",
    accessory: "玉镯",
    food: "绿叶蔬菜",
  },
};

describe("DailyFortuneCardV2 (M4.1)", () => {
  it("渲染时辰问候 + nickname", () => {
    render(<DailyFortuneCardV2 fortune={FORTUNE} nickname="老王" />);
    const greet = screen.getByTestId("hero-greeting");
    expect(greet.textContent ?? "").toMatch(/(清晨好|上午好|午安|下午好|晚上好|夜深了)/);
    expect(greet.textContent).toContain("老王");
  });

  it("无 nickname 时仅显示时辰问候", () => {
    render(<DailyFortuneCardV2 fortune={FORTUNE} />);
    const greet = screen.getByTestId("hero-greeting");
    expect(greet.textContent ?? "").toMatch(/(清晨好|上午好|午安|下午好|晚上好|夜深了)/);
    expect(greet.textContent).not.toContain(",");
  });

  it("渲染 7 个维度 label", () => {
    render(<DailyFortuneCardV2 fortune={FORTUNE} />);
    for (const dim of ["爱情", "财富", "事业", "学习", "健康", "人际", "心情"]) {
      expect(screen.getByText(dim)).toBeInTheDocument();
    }
  });

  it("渲染 8 lucky 属性 label", () => {
    render(<DailyFortuneCardV2 fortune={FORTUNE} />);
    for (const a of [
      "幸运色",
      "幸运方位",
      "幸运时辰",
      "幸运数",
      "幸运花",
      "随身物",
      "配饰",
      "幸运食物",
    ]) {
      expect(screen.getByText(a)).toBeInTheDocument();
    }
  });

  it("渲染 4 个 launcher", () => {
    render(<DailyFortuneCardV2 fortune={FORTUNE} />);
    expect(screen.getByTestId("launcher-divination")).toBeInTheDocument();
    expect(screen.getByTestId("launcher-dream")).toBeInTheDocument();
    expect(screen.getByTestId("launcher-bazi")).toBeInTheDocument();
    expect(screen.getByTestId("launcher-meihua")).toBeInTheDocument();
  });

  it("oneLiner 出现", () => {
    render(<DailyFortuneCardV2 fortune={FORTUNE} />);
    expect(screen.getByText("今天像一壶刚泡开的茶。")).toBeInTheDocument();
  });

  it("详细解读链接指向 /fortune/[date]", () => {
    render(<DailyFortuneCardV2 fortune={FORTUNE} />);
    const link = screen.getByText(/详.*细.*解.*读/);
    expect(link.closest("a")).toHaveAttribute("href", "/fortune/2026-04-27");
  });

  it("oneLiner=null 时不渲染该行", () => {
    render(<DailyFortuneCardV2 fortune={{ ...FORTUNE, oneLiner: null }} />);
    expect(screen.queryByText("今天像一壶刚泡开的茶。")).not.toBeInTheDocument();
  });
});
