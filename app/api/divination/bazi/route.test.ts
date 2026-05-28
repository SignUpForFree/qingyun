import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  ensureUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/ai/check-rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, used: 0, limit: 30 })),
}));

vi.mock("@/lib/safety/guard", () => ({
  guardTexts: vi.fn(() => null),
}));

vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(async () => ({
    textStream: (async function* () {
      yield "八字解读";
    })(),
    usage: Promise.resolve({ totalTokens: 200 }),
  })),
}));

interface ProfileRow {
  id: string;
  user_id: string;
  nickname: string;
  is_default: boolean;
  gender: "male" | "female" | "other";
  birth_date: string;
  birth_time: string;
  birth_calendar: "solar" | "lunar";
  birth_place: string;
  bazi_pillars: string | null;
}

const PROFILE_ROW: ProfileRow = {
  id: "p-1",
  user_id: "user-1",
  nickname: "我自己",
  is_default: true,
  gender: "male",
  birth_date: "1995-03-22",
  birth_time: "09:00",
  birth_calendar: "solar",
  birth_place: "上海",
  bazi_pillars: null,
};

function makeFakeDb(opts: {
  ownedConv?: boolean;
  profiles?: ProfileRow[];
  txProfileExist?: boolean;
} = {}) {
  const ownedConv = opts.ownedConv ?? true;
  const profilesData = opts.profiles ?? [PROFILE_ROW];
  let selectCounter = 0;

  const txMock = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            all: () => (opts.txProfileExist ? [{ id: "ex" }] : []),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        run: () => undefined,
      }),
    }),
  };

  return {
    select: () => ({
      from: () => {
        const idx = selectCounter++;
        return {
          where: () => ({
            limit: (n: number) => {
              if (idx === 0) {
                return Promise.resolve(ownedConv ? [{ id: "conv-1" }] : []);
              }
              // profiles query
              return Promise.resolve(profilesData.slice(0, n));
            },
            // unlimited (Branch A list)
          }),
          // Branch A: select.from.where (no limit)
          ...{}, // noop
        };
      },
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([{ id: "card-1", content: "", metadata: null, created_at: "t" }]),
        run: () => Promise.resolve(),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    transaction: (fn: (tx: typeof txMock) => unknown) => fn(txMock),
  };
}

// Special mock for Branch A (no profileId, no focus): list-all-profiles uses
// db.select().from(profiles).where(...) without .limit()
function makeFakeDbBranchA(opts: { profiles: ProfileRow[]; ownedConv?: boolean }) {
  const ownedConv = opts.ownedConv ?? true;
  let selectCounter = 0;
  return {
    select: () => ({
      from: () => {
        const idx = selectCounter++;
        if (idx === 0) {
          // conversation check
          return {
            where: () => ({
              limit: () => Promise.resolve(ownedConv ? [{ id: "conv-1" }] : []),
            }),
          };
        }
        // profiles list (no limit)
        return {
          where: () => Promise.resolve(opts.profiles),
        };
      },
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([{ id: "card-1", content: "", metadata: null, created_at: "t" }]),
        run: () => Promise.resolve(),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    transaction: (fn: (tx: unknown) => unknown) => fn({}),
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { POST } from "./route";

async function readSse(res: Response): Promise<string> {
  return await res.text();
}

describe("POST /api/divination/bazi — Branch A (list / quick_form)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("无任何 profile → bazi_quick_form 卡", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDbBranchA({ profiles: [] }),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1" }),
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { step: string; card: { metadata: string } };
    expect(j.step).toBe("quick_form_needed");
    expect(j.card.metadata).toContain("bazi_quick_form");
  });

  it("仅 1 个 profile → 跳过 picker 直接 focus_picker（fast-path）", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDbBranchA({ profiles: [PROFILE_ROW] }),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1" }),
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as {
      step: string;
      profileId?: string;
      card: { metadata: string };
    };
    expect(j.step).toBe("focus_picker");
    expect(j.profileId).toBe(PROFILE_ROW.id);
    expect(j.card.metadata).toContain("bazi_focus_picker");
  });

  it("2+ profile → profile_picker 卡（A3 显式选择）", async () => {
    const { getDb } = await import("@/lib/db/client");
    const second = { ...PROFILE_ROW, id: "p-2", nickname: "我妈" };
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDbBranchA({ profiles: [PROFILE_ROW, second] }),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1" }),
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { step: string; card: { metadata: string } };
    expect(j.step).toBe("profile_picker");
    expect(j.card.metadata).toContain("profile_picker");
    expect(j.card.metadata).toContain('"intent":"bazi"');
  });
});

describe("POST /api/divination/bazi — Branch B (quickFormData → 建档)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("提交 quickFormData → 建 profile + focus_picker 卡", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv-1",
          quickFormData: {
            gender: "male",
            birth_time: "1995-03-22 09:00",
            birth_place: "上海 上海 黄浦",
          },
        }),
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as {
      step: string;
      profileId: string;
      card: { metadata: string };
    };
    expect(j.step).toBe("profile_created_focus_picker");
    expect(j.profileId).toMatch(/[0-9a-f-]+/);
    expect(j.card.metadata).toContain("bazi_focus_picker");
  });
});

describe("POST /api/divination/bazi — Branch C (profileId only → focus_picker)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("profileId 校验通过 → 写 focus_picker 卡", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1", profileId: "p-1" }),
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { step: string; card: { metadata: string } };
    expect(j.step).toBe("focus_picker");
    expect(j.card.metadata).toContain("bazi_focus_picker");
  });
});

describe("POST /api/divination/bazi — Branch D (profileId + focus → SSE)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("完整 input → SSE meta + progress + token + card + done", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv-1",
          profileId: "p-1",
          focus: "事业学业",
        }),
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/event-stream/);
    const text = await readSse(r);
    expect(text).toContain("event: meta");
    expect(text).toContain("event: progress");
    const cardIdx = text.indexOf("event: card");
    const tokenIdx = text.indexOf("event: token");
    expect(cardIdx).toBeGreaterThan(-1);
    expect(tokenIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeLessThan(tokenIdx);
    expect(text).toContain("event: done");
    expect(text).toContain("bazi_result");
  });

  it("AI timeout → SSE error event ai_timeout retryable", async () => {
    const { chat } = await import("@/lib/ai/client");
    (chat as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
      new Error("timeout exceeded"),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv-1",
          profileId: "p-1",
          focus: "财运",
        }),
      }),
    );
    expect(r.status).toBe(200);
    const text = await readSse(r);
    expect(text).toContain("event: error");
    expect(text).toContain("ai_timeout");
  });
});

describe("POST /api/divination/bazi — schema validation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("非法 focus（V1.0 旧 '事业' 拒绝）→ 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv-1",
          profileId: "p-1",
          focus: "事业",
        }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("缺 conversationId → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ focus: "综合运势" }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("非法 JSON → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "no",
      }),
    );
    expect(r.status).toBe(400);
  });

  it("rate limit → 429", async () => {
    const { checkRateLimit } = await import("@/lib/ai/check-rate-limit");
    (checkRateLimit as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      allowed: false,
      used: 30,
      limit: 30,
    });
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "c1" }),
      }),
    );
    expect(r.status).toBe(429);
  });
});
