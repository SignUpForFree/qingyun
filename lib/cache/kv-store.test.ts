import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { InProcessKVStore, createKVStore } from "./kv-store";

describe("InProcessKVStore", () => {
  let kv: InProcessKVStore;
  beforeEach(() => {
    kv = new InProcessKVStore();
  });

  it("get null when key missing", async () => {
    expect(await kv.get("missing")).toBeNull();
  });

  it("set + get round-trip", async () => {
    await kv.set("k", { v: 1 });
    expect(await kv.get("k")).toEqual({ v: 1 });
  });

  it("set with ttlSeconds expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await kv.set("k", "v", { ttlSeconds: 5 });
    expect(await kv.get("k")).toBe("v");

    vi.advanceTimersByTime(5_000);
    expect(await kv.get("k")).toBeNull();
    vi.useRealTimers();
  });

  it("set ifAbsent does not overwrite", async () => {
    await kv.set("k", "first");
    expect(await kv.set("k", "second", { ifAbsent: true })).toBe(false);
    expect(await kv.get("k")).toBe("first");
  });

  it("set ifAbsent on expired key succeeds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await kv.set("k", "first", { ttlSeconds: 1 });
    vi.advanceTimersByTime(2_000);
    expect(await kv.set("k", "second", { ifAbsent: true })).toBe(true);
    expect(await kv.get("k")).toBe("second");
    vi.useRealTimers();
  });

  it("incr starts at 1 when missing", async () => {
    expect(await kv.incr("c")).toBe(1);
    expect(await kv.incr("c")).toBe(2);
    expect(await kv.incr("c", 3)).toBe(5);
  });

  it("incr resets on expired entry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await kv.set("c", 10, { ttlSeconds: 1 });
    vi.advanceTimersByTime(2_000);
    expect(await kv.incr("c")).toBe(1);
    vi.useRealTimers();
  });

  it("expire updates ttl on existing key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await kv.set("k", "v");
    expect(await kv.expire("k", 10)).toBe(true);
    expect(await kv.ttl("k")).toBe(10);
    vi.advanceTimersByTime(11_000);
    expect(await kv.get("k")).toBeNull();
    vi.useRealTimers();
  });

  it("ttl returns -2 for missing, -1 for permanent", async () => {
    expect(await kv.ttl("missing")).toBe(-2);
    await kv.set("k", "v");
    expect(await kv.ttl("k")).toBe(-1);
  });

  it("del removes key", async () => {
    await kv.set("k", "v");
    expect(await kv.del("k")).toBe(true);
    expect(await kv.del("k")).toBe(false);
    expect(await kv.get("k")).toBeNull();
  });
});

describe("createKVStore factory", () => {
  afterEach(() => {
    delete process.env.KV_STORE;
  });

  it("returns InProcessKVStore by default", () => {
    const kv = createKVStore();
    expect(kv).toBeInstanceOf(InProcessKVStore);
  });

  it("respects env KV_STORE=memory", () => {
    process.env.KV_STORE = "memory";
    expect(createKVStore()).toBeInstanceOf(InProcessKVStore);
  });

  it("throws on KV_STORE=redis (not implemented)", () => {
    process.env.KV_STORE = "redis";
    expect(() => createKVStore()).toThrow(/not yet implemented/);
  });

  it("throws on unknown kind", () => {
    expect(() => createKVStore({ kind: "x" as never })).toThrow(/Unknown kind/);
  });
});
