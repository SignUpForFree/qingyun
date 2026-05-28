import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeihuaReadingMarkdown } from "./MeihuaReadingMarkdown";

describe("MeihuaReadingMarkdown", () => {
  it("渲染一级标题", () => {
    render(<MeihuaReadingMarkdown text="# 测算结果解读" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("测算结果解读");
  });

  it("渲染加粗二级标题", () => {
    render(<MeihuaReadingMarkdown text="**## 一、测算溯源 · 象数推演**" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "一、测算溯源 · 象数推演",
    );
  });

  it("段落空行分隔", () => {
    render(
      <MeihuaReadingMarkdown text={"测算时间：2026年5月19日\n\n**## 一、测算溯源**"} />,
    );
    expect(screen.getByText(/测算时间/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
  });

  it("不显示裸露 ###（模版行 **### 本卦**  副标题）", () => {
    render(
      <MeihuaReadingMarkdown text="**### 本卦 · 随（䷐）**  主兆当下之事" />,
    );
    const h3 = screen.getByRole("heading", { level: 3 });
    expect(h3).toHaveTextContent("本卦 · 随");
    expect(h3.textContent).not.toMatch(/^###/);
    expect(screen.queryByText(/^###/)).toBeNull();
  });

  it("渲染裸 ### 三级标题", () => {
    render(<MeihuaReadingMarkdown text="### 互卦 · 渐（䷴）· 兆示发展之过程" />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("互卦 · 渐");
    expect(screen.queryByText("###")).toBeNull();
  });

  it("渲染本卦 · 行副标题", () => {
    render(<MeihuaReadingMarkdown text="本卦 · 鼎（䷱）  主兆当下之事" />);
    expect(screen.getByText(/本卦 · 鼎/)).toBeTruthy();
  });

  it("渲染解梦整行 **章节标题**（无 #）", () => {
    render(<MeihuaReadingMarkdown text="**梦境核心解析**" />);
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2).toHaveTextContent("梦境核心解析");
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it("行内 **加粗** 与 * 列表项", () => {
    render(
      <MeihuaReadingMarkdown
        text={"* **河**：象征情绪之流\n* **抓鱼**：代表机遇"}
      />,
    );
    expect(screen.getByText("河", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("抓鱼", { selector: "strong" })).toBeTruthy();
  });

  it("渲染体用 Tab 表格", () => {
    render(
      <MeihuaReadingMarkdown
        text={
          "体卦（问卦者自身）\t巽\t木\t风木相随\n体卦（问卦者自身）\t离\t火\t火势上扬"
        }
      />,
    );
    expect(screen.getByRole("table")).toBeTruthy();
  });
});
