import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerJob, listRegistered, startCron, resetCron } from "./index";

describe("cron registry", () => {
  beforeEach(() => resetCron());

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
    expect(() => registerJob({ name: "dup", expr: "1 1 * * *", task: async () => {} })).toThrow(/already registered/);
  });

  it("listRegistered returns a copy (not internal array)", () => {
    registerJob({ name: "x", expr: "0 0 * * *", task: async () => {} });
    const a = listRegistered();
    const b = listRegistered();
    // 确保返回的是 readonly 拷贝
    expect(a).toEqual(b);
  });

  it("startCron is a no-op when no jobs registered", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => startCron()).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("startCron is idempotent (second call does not re-log)", () => {
    registerJob({ name: "x", expr: "0 0 * * *", task: async () => {} });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    startCron();
    startCron();
    // 第一次记两条（header + 1 job）；第二次完全 skip
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("startCron logs registered jobs (M0 stub)", () => {
    registerJob({ name: "daily-fortune-push", expr: "30 0 * * *", task: async () => {} });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    startCron();
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/M0 stub.*1 job/));
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/daily-fortune-push.*30 0/));
    spy.mockRestore();
  });
});
