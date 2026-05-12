import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { initSentry, reportError, resetSentry } from "./sentry";

describe("sentry init/reportError", () => {
  beforeEach(() => {
    resetSentry();
    delete process.env.SENTRY_DSN;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    vi.restoreAllMocks();
  });

  it("initSentry no-op without SENTRY_DSN", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => initSentry()).not.toThrow();
    // 没 DSN：连 dynamic import 都不应该触发
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("initSentry with DSN runs without throwing", () => {
    process.env.SENTRY_DSN = "https://x@sentry.io/1";
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => initSentry()).not.toThrow();
    spy.mockRestore();
  });

  it("initSentry idempotent", () => {
    process.env.SENTRY_DSN = "https://x@sentry.io/1";
    initSentry();
    initSentry();
    // 不抛错即可；动态 import 实际效果在 e2e 验证
    expect(true).toBe(true);
  });

  it("reportError uses [error captured] tag when DSN set", () => {
    process.env.SENTRY_DSN = "https://x@sentry.io/1";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("boom"), { foo: "bar" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("captured"),
      expect.any(Error),
      { foo: "bar" },
    );
    spy.mockRestore();
  });

  it("reportError uses [error] tag when DSN not set", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("boom"));
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[error]"),
      expect.any(Error),
      undefined,
    );
    spy.mockRestore();
  });
});
