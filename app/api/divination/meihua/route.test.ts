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
      yield "梅花卦象速断；";
      yield "体用关系；";
      yield "应期建议。";
    })(),
    usage: Promise.resolve({ totalTokens: 120 }),
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
  profileFound?: boolean;
} = {}) {
  const ownedConv = opts.ownedConv ?? true;
  const profilesData = opts.profiles ?? [PROFILE_ROW];
  const profileFound = opts.profileFound ?? true;
  let selectCounter = 0;

  return {
    select: () => ({
      from: () => {
        const idx = selectCounter++;
        // where() 返回一个对象：可 await（Branch A list profiles），也可继续 .limit(n)
        const where = () => {
          const limit = (n: number) => {
            if (idx === 0) {
              // conversations 校验
              return Promise.resolve(ownedConv ? [{ id: "conv-1" }] : []);
            }
            // profile 单条校验
            return Promise.resolve(profileFound ? profilesData.slice(0, n) : []);
          };
          // 同时支持 await db.select().from().where(...) 直接拿数组（Branch A list）
          const thenable = {
            limit,
            then: (cb: (v: ProfileRow[]) => unknown) =>
              Promise.resolve(profilesData).then(cb),
          };
          return thenable;
        };
        return { where };
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
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { POST } from "./route";

async function readSse(res: Response): Promise<string> {
  return await res.text();
}

describe("POST /api/divination/meihua — Branch A (list profiles)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("无 profile → bazi_quick_form 卡（先建档）", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ profiles: [] }),
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

  it("仅 1 个 profile → 跳过 picker 直接 number_input（fast-path）", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ profiles: [PROFILE_ROW] }),
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
    expect(j.step).toBe("number_input");
    expect(j.profileId).toBe(PROFILE_ROW.id);
    expect(j.card.metadata).toContain("meihua_number_input");
  });

  it("2+ profile → profile_picker 卡（A3 显式选择）", async () => {
    const { getDb } = await import("@/lib/db/client");
    const second = { ...PROFILE_ROW, id: "p-2", nickname: "我爸" };
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ profiles: [PROFILE_ROW, second] }),
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
    expect(j.card.metadata).toContain('"intent":"meihua"');
  });
});

describe("POST /api/divination/meihua — Branch B (profileId only → number_input)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("profileId 校验通过 → meihua_number_input 卡", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1", profileId: "p-1" }),
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { step: string; card: { metadata: string } };
    expect(j.step).toBe("number_input");
    expect(j.card.metadata).toContain("meihua_number_input");
  });
});

describe("POST /api/divination/meihua — Branch C (profileId + numbers → SSE)", () => {
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
          numbers: [123, 456, 789],
          userQuestion: "近期事业方向",
        }),
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/event-stream/);
    const text = await readSse(r);
    expect(text).toContain("event: meta");
    expect(text).toContain("event: progress");
    expect(text).toContain("event: token");
    expect(text).toContain("event: card");
    expect(text).toContain("event: done");
    expect(text).toContain("meihua_result");
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
          numbers: [1, 2, 3],
        }),
      }),
    );
    expect(r.status).toBe(200);
    const text = await readSse(r);
    expect(text).toContain("event: error");
    expect(text).toContain("ai_timeout");
  });
});

describe("POST /api/divination/meihua — schema validation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("numbers 超过 3 个 → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv-1",
          profileId: "p-1",
          numbers: [1, 2, 3, 4],
        }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("numbers 包含 1000（超出 1-999）→ 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv-1",
          profileId: "p-1",
          numbers: [1000],
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
        body: JSON.stringify({ numbers: [1, 2, 3] }),
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

  it("会话不存在 → 404", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ ownedConv: false }),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "wrong" }),
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
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1", profileId: "p-other" }),
      }),
    );
    expect(r.status).toBe(404);
  });
});
