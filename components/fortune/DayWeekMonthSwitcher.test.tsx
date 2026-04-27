/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DayWeekMonthSwitcher } from "./DayWeekMonthSwitcher";

describe("DayWeekMonthSwitcher (M4.5)", () => {
  it("3 段都渲染", () => {
    render(<DayWeekMonthSwitcher scope="day" onChange={() => {}} />);
    expect(screen.getByText("日运")).toBeInTheDocument();
    expect(screen.getByText("周运")).toBeInTheDocument();
    expect(screen.getByText("月运")).toBeInTheDocument();
  });

  it("被选中段标记 data-active=true", () => {
    render(<DayWeekMonthSwitcher scope="week" onChange={() => {}} />);
    expect(screen.getByTestId("switcher-week")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("switcher-day")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("switcher-month")).toHaveAttribute("data-active", "false");
  });

  it("点击非当前段 → 调 onChange(next)", () => {
    const onChange = vi.fn();
    render(<DayWeekMonthSwitcher scope="day" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("switcher-month"));
    expect(onChange).toHaveBeenCalledWith("month");
  });

  it("ARIA role tablist + 每段 role=tab + aria-selected", () => {
    render(<DayWeekMonthSwitcher scope="day" onChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByTestId("switcher-day")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("switcher-week")).toHaveAttribute("aria-selected", "false");
  });
});
