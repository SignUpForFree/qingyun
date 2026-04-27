import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  ensureUserId: vi.fn(async () => "user-1"),
}));

function makeFakeDb(opts: {
  ownedConv?: boolean;
  profileFound?: boolean;
} = {}) {
  const ownedConv = opts.ownedConv ?? true;
  const profileFound = opts.profileFound ?? true;
  let selectCounter = 0;
  let updateCalled = false;
  return {
    select: () => ({
      from: () => {
        const idx = selectCounter++;
        return {
          where: () => ({
            limit: () =>
              Promise.resolve(
                idx === 0
                  ? ownedConv
                    ? [{ id: "conv-1" }]
                    : []
                  : profileFound
                    ? [{ id: "p-1" }]
                    : [],
              ),
          }),
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => {
          updateCalled = true;
          return Promise.resolve();
        },
      }),
    }),
    _updateCalled: () => updateCalled,
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/chat/set-profile (M2.29)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("成功：合法 conversationId + profileId → conversations.profile_id 落库", async () => {
    const fake = makeFakeDb();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(fake);
    const r = await POST(
      new Request("http://test/api/chat/set-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1", profileId: "p-1" }),
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; conversationId: string; profileId: string };
    expect(j.ok).toBe(true);
    expect(j.conversationId).toBe("conv-1");
    expect(j.profileId).toBe("p-1");
    expect(fake._updateCalled()).toBe(true);
  });

  it("conversationId 不属于当前用户 → 404", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ ownedConv: false }),
    );
    const r = await POST(
      new Request("http://test/api/chat/set-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "wrong", profileId: "p-1" }),
      }),
    );
    expect(r.status).toBe(404);
  });

  it("profileId 不属于当前用户 → 404", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ profileFound: false }),
    );
    const r = await POST(
      new Request("http://test/api/chat/set-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1", profileId: "p-other" }),
      }),
    );
    expect(r.status).toBe(404);
  });

  it("缺 profileId → 400", async () => {
    const r = await POST(
      new Request("http://test/api/chat/set-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1" }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("缺 conversationId → 400", async () => {
    const r = await POST(
      new Request("http://test/api/chat/set-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: "p-1" }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("非法 JSON → 400", async () => {
    const r = await POST(
      new Request("http://test/api/chat/set-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "broken",
      }),
    );
    expect(r.status).toBe(400);
  });
});
