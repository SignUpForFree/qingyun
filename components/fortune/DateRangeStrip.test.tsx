/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangeStrip } from "./DateRangeStrip";

describe("DateRangeStrip (M4.5)", () => {
  it("渲染 7 个日期 cell", () => {
    render(
      <DateRangeStrip value="2026-04-27" today={new Date("2026-04-27T12:00:00Z")} onChange={() => {}} />,
    );
    const strip = screen.getByTestId("date-range-strip");
    expect(strip.children.length).toBe(7);
  });

  it("中心日期前后各 3 天", () => {
    render(
      <DateRangeStrip value="2026-04-27" today={new Date("2026-04-27T12:00:00Z")} onChange={() => {}} />,
    );
    expect(screen.getByTestId("day-2026-04-24")).toBeInTheDocument();
    expect(screen.getByTestId("day-2026-04-27")).toBeInTheDocument();
    expect(screen.getByTestId("day-2026-04-30")).toBeInTheDocument();
    expect(screen.queryByTestId("day-2026-04-23")).toBeNull();
    expect(screen.queryByTestId("day-2026-05-01")).toBeNull();
  });

  it("今日 cell 标记 data-today=true", () => {
    render(
      <DateRangeStrip value="2026-04-25" today={new Date("2026-04-27T12:00:00Z")} onChange={() => {}} />,
    );
    expect(screen.getByTestId("day-2026-04-27")).toHaveAttribute("data-today", "true");
    expect(screen.getByTestId("day-2026-04-25")).toHaveAttribute("data-today", "false");
  });

  it("已选中 cell 标记 data-selected=true", () => {
    render(
      <DateRangeStrip value="2026-04-25" today={new Date("2026-04-27T12:00:00Z")} onChange={() => {}} />,
    );
    expect(screen.getByTestId("day-2026-04-25")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("day-2026-04-27")).toHaveAttribute("data-selected", "false");
  });

  it("点击 cell 调 onChange(iso)", () => {
    const onChange = vi.fn();
    render(
      <DateRangeStrip
        value="2026-04-27"
        today={new Date("2026-04-27T12:00:00Z")}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("day-2026-04-25"));
    expect(onChange).toHaveBeenCalledWith("2026-04-25");
  });

  it("跨月也正确：value=2026-04-30 时显示 27/28/29/30/01/02/03", () => {
    render(
      <DateRangeStrip
        value="2026-04-30"
        today={new Date("2026-04-30T12:00:00Z")}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId("day-2026-04-27")).toBeInTheDocument();
    expect(screen.getByTestId("day-2026-05-01")).toBeInTheDocument();
    expect(screen.getByTestId("day-2026-05-03")).toBeInTheDocument();
  });
});
