import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { initSentry, reportError, resetSentry } from "./sentry";

describe("sentry stub", () => {
  beforeEach(() => {
    resetSentry();
    delete process.env.SENTRY_DSN;
  });

  it("initSentry no-op without SENTRY_DSN", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => initSentry()).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("initSentry logs info when SENTRY_DSN set", () => {
    process.env.SENTRY_DSN = "https://x@sentry.io/1";
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    initSentry();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[sentry]"));
    spy.mockRestore();
  });

  it("initSentry idempotent (calling twice does not double-log)", () => {
    process.env.SENTRY_DSN = "https://x@sentry.io/1";
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    initSentry();
    initSentry();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("reportError uses [error captured] tag when DSN set", () => {
    process.env.SENTRY_DSN = "https://x@sentry.io/1";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("boom"), { foo: "bar" });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("captured"), expect.any(Error), { foo: "bar" });
    spy.mockRestore();
  });

  it("reportError uses [error] tag when DSN not set", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("boom"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[error]"), expect.any(Error), undefined);
    spy.mockRestore();
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });
});
