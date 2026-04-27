import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ALL_FUNCTION_ICON_NAMES,
  FunctionIcon,
  type FunctionIconName,
} from "./FunctionIcon";

describe("FunctionIcon (M4.27)", () => {
  it("18 个 icon 名全部齐备", () => {
    // 4 launcher + 7 home dim + 6 抽签 dim + 1 generic = 18
    expect(ALL_FUNCTION_ICON_NAMES.length).toBe(18);
  });

  it.each(ALL_FUNCTION_ICON_NAMES)("name=%s 渲染 svg + testid", (name) => {
    render(<FunctionIcon name={name} />);
    const svg = screen.getByTestId(`fn-icon-${name}`);
    expect(svg.tagName.toLowerCase()).toBe("svg");
  });

  it("默认 stroke=currentColor", () => {
    render(<FunctionIcon name="divination" />);
    const svg = screen.getByTestId("fn-icon-divination");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
  });

  it("size=32 渲染对应宽高", () => {
    render(<FunctionIcon name="bazi" size={32} />);
    const svg = screen.getByTestId("fn-icon-bazi");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("自定义 stroke 颜色覆盖默认", () => {
    render(<FunctionIcon name="meihua" stroke="#a87c5e" />);
    const svg = screen.getByTestId("fn-icon-meihua");
    expect(svg.getAttribute("stroke")).toBe("#a87c5e");
  });

  it("aria-hidden=true（装饰性图标，避免重复读屏）", () => {
    render(<FunctionIcon name="love" />);
    const svg = screen.getByTestId("fn-icon-love");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("className 透传到 svg", () => {
    render(<FunctionIcon name="health" className="text-red-500" />);
    const svg = screen.getByTestId("fn-icon-health");
    expect(svg.className.baseVal).toContain("text-red-500");
  });

  it("4 个 launcher icon 可独立渲染", () => {
    const launchers: FunctionIconName[] = ["divination", "dream", "bazi", "meihua"];
    render(
      <div>
        {launchers.map((n) => (
          <FunctionIcon key={n} name={n} />
        ))}
      </div>,
    );
    for (const n of launchers) {
      expect(screen.getByTestId(`fn-icon-${n}`)).toBeInTheDocument();
    }
  });

  it("7 home dim icon 名集合一致 (爱情/财富/事业/学习/健康/人际/心情)", () => {
    const expected: FunctionIconName[] = [
      "love",
      "wealth",
      "career",
      "study",
      "health",
      "social",
      "mood",
    ];
    for (const n of expected) {
      expect(ALL_FUNCTION_ICON_NAMES).toContain(n);
    }
  });

  it("6 抽签 dim icon 名集合一致 (综合/事业学业/财/感情/人际贵人/平安)", () => {
    const expected: FunctionIconName[] = [
      "overall",
      "career-study",
      "fortune",
      "romance",
      "patron",
      "safety",
    ];
    for (const n of expected) {
      expect(ALL_FUNCTION_ICON_NAMES).toContain(n);
    }
  });

  it("svg 含 path / circle / rect / line 至少其一（实际线稿）", () => {
    for (const name of ALL_FUNCTION_ICON_NAMES) {
      const { unmount } = render(<FunctionIcon name={name} />);
      const svg = screen.getByTestId(`fn-icon-${name}`);
      const primitives = svg.querySelectorAll("path, circle, rect, line");
      expect(primitives.length).toBeGreaterThan(0);
      unmount();
    }
  });
});
