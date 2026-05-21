import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MessageList,
  buildScrollAnchorKey,
  scrollContainerToBottom,
  scheduleScrollToBottom,
} from "./MessageList";
import type { DisplayMessage } from "./MessageBubble";

describe("buildScrollAnchorKey", () => {
  it("includes metadata so in-place card updates re-scroll", () => {
    const a: DisplayMessage = {
      id: "m1",
      role: "assistant",
      content: "",
      created_at: "2026-01-01",
      metadata: JSON.stringify({ ui: "slip_draw_reveal", phase: "animating" }),
    };
    const b = { ...a, metadata: JSON.stringify({ ui: "slip_draw_reveal", phase: "revealed" }) };
    expect(buildScrollAnchorKey([a])).not.toBe(buildScrollAnchorKey([b]));
  });
});

describe("scrollContainerToBottom", () => {
  it("sets scrollTop to bottom for auto behavior", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 200, configurable: true });
    scrollContainerToBottom(el, "auto");
    expect(el.scrollTop).toBe(300);
  });
});

describe("scheduleScrollToBottom", () => {
  it("sets scrollTop immediately and via scrollTo", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollHeight", { value: 800, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });
    el.scrollTo = vi.fn();
    const cancel = scheduleScrollToBottom(el, "auto");
    expect(el.scrollTop).toBe(400);
    vi.advanceTimersByTime(200);
    cancel();
    vi.useRealTimers();
  });
});

describe("MessageList auto-scroll", () => {
  beforeEach(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
  });

  it("scroll area uses min-h-0 flex-1 overflow", () => {
    render(<MessageList messages={[]} streamingText={null} />);
    const root = document.querySelector('[data-testid="message-list-scroll"]');
    expect(root?.className).toMatch(/min-h-0/);
    expect(root?.className).toMatch(/overflow-y-auto/);
  });

  it("scrolls list container when messages are added", () => {
    const msgs: DisplayMessage[] = [
      { id: "1", role: "user", content: "hi", created_at: "2026-01-01" },
    ];
    const { rerender } = render(
      <MessageList messages={msgs} streamingText={null} />,
    );
    const root = document.querySelector(
      '[data-testid="message-list-scroll"]',
    ) as HTMLDivElement;
    expect(root).toBeTruthy();
    Object.defineProperty(root, "scrollHeight", { value: 1200, configurable: true });
    Object.defineProperty(root, "clientHeight", { value: 400, configurable: true });
    root.scrollTop = 0;

    rerender(
      <MessageList
        messages={[
          ...msgs,
          { id: "2", role: "assistant", content: "ok", created_at: "2026-01-02" },
        ]}
        streamingText={null}
      />,
    );
    expect(root.scrollTop).toBeGreaterThan(0);
  });
});
