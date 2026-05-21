import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SlipDrawRevealCard } from "./SlipDrawRevealCard";
import type { SlipDrawRevealMeta } from "./meta-types";

const revealedMeta: SlipDrawRevealMeta = {
  ui: "slip_draw_reveal",
  phase: "revealed",
  slipNumber: 6,
  level: "渐顺",
  title: "福渐来",
  poemLines: ["一", "二", "三", "四"],
  imageUrl: "https://example.com/slip.png",
  category: "综合运势",
  reading: "福气慢慢积累",
};

describe("SlipDrawRevealCard", () => {
  it("animating phase shows pull then zoom stages", async () => {
    vi.useFakeTimers();
    render(
      <SlipDrawRevealCard
        meta={{ ui: "slip_draw_reveal", phase: "animating", durationMs: 3000 }}
      />,
    );
    expect(screen.getByText("仙女抽签中…")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByTestId("slip-zoom-stage")).toBeInTheDocument();
    expect(screen.getByTestId("slip-placeholder-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("slip-content-reveal")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();
  });

  it("revealed phase skips animation and shows slip card", () => {
    render(<SlipDrawRevealCard meta={revealedMeta} onExplain={vi.fn()} />);
    expect(screen.queryByTestId("heavenly-slip-draw")).not.toBeInTheDocument();
    expect(screen.getByText("立即解读")).toBeInTheDocument();
  });

  it("zoom then result when API returns mid-flight", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <SlipDrawRevealCard
        meta={{ ui: "slip_draw_reveal", phase: "animating", durationMs: 3000 }}
        onExplain={vi.fn()}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    rerender(
      <SlipDrawRevealCard
        meta={{ ...revealedMeta, phase: "animating" }}
        onExplain={vi.fn()}
      />,
    );
    expect(screen.getByTestId("slip-placeholder-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("slip-content-reveal")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId("slip-content-reveal")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("立即解读")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
