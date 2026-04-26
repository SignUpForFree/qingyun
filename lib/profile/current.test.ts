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
  getCurrentProfileId,
  setCurrentProfileId,
  clearCurrentProfileId,
  PROFILE_COOKIE_KEY,
} from "./current";

describe("getCurrentProfileId / setCurrentProfileId / clearCurrentProfileId", () => {
  beforeEach(() => {
    cookieStore.clear();
    cookieDeleted.clear();
  });

  it("无 cookie → null", async () => {
    expect(await getCurrentProfileId()).toBeNull();
  });

  it("set 后能读到", async () => {
    await setCurrentProfileId("profile-abc");
    expect(await getCurrentProfileId()).toBe("profile-abc");
  });

  it("set 写到正确 key", async () => {
    await setCurrentProfileId("profile-xyz");
    expect(cookieStore.get(PROFILE_COOKIE_KEY)).toBe("profile-xyz");
  });

  it("clear 后再读 null", async () => {
    await setCurrentProfileId("p1");
    await clearCurrentProfileId();
    expect(await getCurrentProfileId()).toBeNull();
    expect(cookieDeleted.has(PROFILE_COOKIE_KEY)).toBe(true);
  });

  it("覆盖写入", async () => {
    await setCurrentProfileId("p1");
    await setCurrentProfileId("p2");
    expect(await getCurrentProfileId()).toBe("p2");
  });
});
