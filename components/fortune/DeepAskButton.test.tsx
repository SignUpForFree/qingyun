/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeepAskButton } from "./DeepAskButton";

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

describe("DeepAskButton (M4.6)", () => {
  it("无 prefill → href=/chat", () => {
    render(<DeepAskButton />);
    const btn = screen.getByTestId("deep-ask-button");
    expect(btn).toHaveAttribute("href", "/chat");
  });

  it("有 prefill → href=/chat?prefill=<encoded>", () => {
    render(<DeepAskButton prefill="今天财运怎么样？" />);
    const btn = screen.getByTestId("deep-ask-button");
    expect(btn.getAttribute("href")).toContain("/chat?prefill=");
    expect(btn.getAttribute("href")).toContain(encodeURIComponent("今天财运怎么样？"));
  });

  it("默认 label 是『深入追问 →』", () => {
    render(<DeepAskButton />);
    expect(screen.getByText(/深入追问/)).toBeInTheDocument();
  });

  it("自定义 label 生效", () => {
    render(<DeepAskButton label="再问一句" />);
    expect(screen.getByText("再问一句")).toBeInTheDocument();
  });
});
