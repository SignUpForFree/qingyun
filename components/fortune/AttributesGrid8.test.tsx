/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttributesGrid8 } from "./AttributesGrid8";
import type { Attributes } from "@/lib/fortune/attributes";

const FULL: Attributes = {
  color: { name: "新柳绿", hex: "#BFD9C2" },
  direction: "正东",
  hour: { branch: "辰", range: "07:00–09:00" },
  numbers: [3, 8],
  number: 3,
  flower: "栀子",
  item: "一卷书",
  accessory: "玉镯 / 木珠",
  food: "绿叶蔬菜（菠菜、青菜、竹笋）",
};

describe("AttributesGrid8 (M4.2)", () => {
  it("渲染 8 个 label", () => {
    render(<AttributesGrid8 attrs={FULL} />);
    for (const label of [
      "幸运色",
      "幸运方位",
      "幸运时辰",
      "幸运数",
      "幸运花",
      "随身物",
      "配饰",
      "幸运食物",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("渲染 8 个 value", () => {
    render(<AttributesGrid8 attrs={FULL} />);
    expect(screen.getByText("新柳绿")).toBeInTheDocument();
    expect(screen.getByText("正东")).toBeInTheDocument();
    expect(screen.getByText("07:00–09:00")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("栀子")).toBeInTheDocument();
    expect(screen.getByText("一卷书")).toBeInTheDocument();
    expect(screen.getByText("玉镯 / 木珠")).toBeInTheDocument();
  });

  it("幸运色 cell 应用 textShadow（hex tone 转光晕）", () => {
    render(<AttributesGrid8 attrs={FULL} />);
    const cell = screen.getByTestId("attr-幸运色");
    expect(cell.style.textShadow).toContain("#BFD9C2");
  });

  it("非幸运色 cell 无 textShadow", () => {
    render(<AttributesGrid8 attrs={FULL} />);
    const cell = screen.getByTestId("attr-幸运方位");
    expect(cell.style.textShadow).toBe("");
  });

  it("缺字段优雅降级为 —", () => {
    render(<AttributesGrid8 attrs={{}} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(8);
  });

  it("4×2 grid 布局（class grid-cols-4）", () => {
    const { container } = render(<AttributesGrid8 attrs={FULL} />);
    const grid = container.querySelector('[data-testid="attributes-grid-8"]');
    expect(grid?.className).toContain("grid-cols-4");
  });
});
