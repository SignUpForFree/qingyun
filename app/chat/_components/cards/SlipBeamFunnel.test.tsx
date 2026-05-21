import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlipBeamFunnel } from "./SlipBeamFunnel";

describe("SlipBeamFunnel", () => {
  it("renders funnel beams from origin point", () => {
    render(<SlipBeamFunnel pullMs={1200} />);
    expect(screen.getByTestId("slip-beam-funnel")).toBeInTheDocument();
    expect(screen.getByTestId("slip-beam-origin")).toBeInTheDocument();
    expect(screen.getByTestId("slip-beam-funnel-volume")).toBeInTheDocument();
    expect(screen.getByTestId("slip-beam-core")).toBeInTheDocument();
  });
});
