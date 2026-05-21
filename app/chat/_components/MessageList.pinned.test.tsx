import { describe, expect, it } from "vitest";
import { isScrollPinnedToBottom } from "./MessageList";

describe("isScrollPinnedToBottom", () => {
  it("returns true when near bottom", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });
    el.scrollTop = 550;
    expect(isScrollPinnedToBottom(el)).toBe(true);
  });

  it("returns false when scrolled up", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });
    el.scrollTop = 100;
    expect(isScrollPinnedToBottom(el)).toBe(false);
  });
});
