import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeavenlySlipDraw } from "./HeavenlySlipDraw";

describe("HeavenlySlipDraw", () => {
  it("renders pull phase with fairy and slip from body", () => {
    render(<HeavenlySlipDraw pullDurationMs={1000} />);
    expect(screen.getByTestId("heavenly-slip-draw")).toBeInTheDocument();
    expect(screen.getByTestId("fairy-avatar")).toHaveAttribute("src", "/images/ai-avatar.png");
    expect(screen.getByTestId("slip-from-body")).toBeInTheDocument();
    expect(screen.getByTestId("slip-mystic-fx")).toBeInTheDocument();
    expect(screen.getByTestId("slip-beam-funnel")).toBeInTheDocument();
    expect(screen.getByTestId("slip-beam-core")).toBeInTheDocument();
    expect(screen.getByTestId("slip-holy-aura")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("仙女抽签中…");
  });

  it("fadingOut enters zoom shell with mist status", () => {
    render(<HeavenlySlipDraw fadingOut />);
    expect(screen.getByRole("status")).toHaveTextContent("灵签渐显…");
  });
});
