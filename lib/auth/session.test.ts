import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const cookieStore = new Map<string, string>();
const cookieDeleted = new Set<string>();

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (k: string) => (cookieStore.has(k) ? { value: cookieStore.get(k) } : undefined),
      set: (k: string, v: string) => {
        cookieStore.set(k, v);
        cookieDeleted.delete(k);
      },
      delete: (k: string) => {
        cookieStore.delete(k);
        cookieDeleted.add(k);
      },
    }),
}));

import {
  getCurrentUserId,
  ensureUserId,
  setUserId,
  clearUserId,
  requireUserId,
  SESSION_COOKIE_KEY,
  UnauthenticatedError,
} from "./session";

beforeEach(() => {
  cookieStore.clear();
  cookieDeleted.clear();
});

describe("getCurrentUserId", () => {
  it("无 cookie → null", async () => {
    expect(await getCurrentUserId()).toBeNull();
  });

  it("有 cookie 返回值", async () => {
    cookieStore.set(SESSION_COOKIE_KEY, "user-x");
    expect(await getCurrentUserId()).toBe("user-x");
  });
});

describe("setUserId", () => {
  it("写到正确 key", async () => {
    await setUserId("user-y");
    expect(cookieStore.get(SESSION_COOKIE_KEY)).toBe("user-y");
  });
});

describe("ensureUserId", () => {
  it("已有 cookie 返回原值", async () => {
    await setUserId("existing");
    expect(await ensureUserId()).toBe("existing");
  });

  it("无 cookie 自动生成 uuid 并写入", async () => {
    const id = await ensureUserId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(cookieStore.get(SESSION_COOKIE_KEY)).toBe(id);
  });

  it("两次调用得到相同 id（不重复生成）", async () => {
    const a = await ensureUserId();
    const b = await ensureUserId();
    expect(a).toBe(b);
  });
});

describe("clearUserId", () => {
  it("清除后再读 null", async () => {
    await setUserId("u");
    await clearUserId();
    expect(await getCurrentUserId()).toBeNull();
    expect(cookieDeleted.has(SESSION_COOKIE_KEY)).toBe(true);
  });
});

describe("requireUserId", () => {
  it("有 cookie 返回值", async () => {
    await setUserId("u");
    expect(await requireUserId()).toBe("u");
  });

  it("无 cookie 抛 UnauthenticatedError", async () => {
    await expect(requireUserId()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
