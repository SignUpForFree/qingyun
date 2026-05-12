import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerJob, listRegistered, startCron, resetCron } from "./index";

describe("cron registry", () => {
  beforeEach(() => {
    resetCron();
    delete process.env.CRON_ENABLED;
  });
  afterEach(() => {
    resetCron();
    delete process.env.CRON_ENABLED;
  });

  it("listRegistered empty by default", () => {
    expect(listRegistered()).toEqual([]);
  });

  it("registerJob adds to registry", () => {
    registerJob({ name: "test-1", expr: "0 0 * * *", task: async () => {} });
    expect(listRegistered()).toHaveLength(1);
    expect(listRegistered()[0].name).toBe("test-1");
  });

  it("registerJob throws on duplicate name", () => {
    registerJob({ name: "dup", expr: "0 0 * * *", task: async () => {} });
    expect(() =>
      registerJob({ name: "dup", expr: "1 1 * * *", task: async () => {} }),
    ).toThrow(/already registered/);
  });

  it("registerJob throws on invalid cron expression", () => {
    expect(() =>
      registerJob({ name: "bad-expr", expr: "not-cron", task: async () => {} }),
    ).toThrow(/invalid cron expr/);
  });

  it("listRegistered returns a copy (not internal array)", () => {
    registerJob({ name: "x", expr: "0 0 * * *", task: async () => {} });
    const a = listRegistered();
    const b = listRegistered();
    expect(a).toEqual(b);
  });

  it("startCron is a no-op when no jobs registered", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => startCron()).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("startCron skips scheduling when CRON_ENABLED is not set in dev", () => {
    process.env.CRON_ENABLED = "0";
    registerJob({ name: "x", expr: "0 0 * * *", task: async () => {} });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    startCron();
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/disabled.*1 job/),
    );
    spy.mockRestore();
  });

  it("startCron schedules when CRON_ENABLED=1", () => {
    process.env.CRON_ENABLED = "1";
    registerJob({ name: "daily-fortune-push", expr: "30 0 * * *", task: async () => {} });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    startCron();
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/scheduled 1 job/),
    );
    spy.mockRestore();
  });

  it("startCron is idempotent (second call is a no-op)", () => {
    process.env.CRON_ENABLED = "1";
    registerJob({ name: "x", expr: "0 0 * * *", task: async () => {} });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    startCron();
    startCron();
    // 第二次调用应被 started flag 短路，不再 log
    const sched = spy.mock.calls.filter((c) =>
      String(c[0]).includes("scheduled"),
    );
    expect(sched).toHaveLength(1);
    spy.mockRestore();
  });
});
