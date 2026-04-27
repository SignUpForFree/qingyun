import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  ensureUserId: vi.fn(async () => "user-1"),
}));

interface SearchHit {
  id: string;
  title: string;
  last_message_at: string | null;
  snippet: string | null;
}

const HITS: SearchHit[] = [
  {
    id: "c-1",
    title: "感情话题",
    last_message_at: "2026-04-27T12:00:00Z",
    snippet: "...聊到<b>感情</b>...",
  },
  {
    id: "c-2",
    title: "另一段对话",
    last_message_at: "2026-04-26T12:00:00Z",
    snippet: "...问<b>感情</b>事...",
  },
];

function makeFakeDb(opts: { hits?: SearchHit[]; throws?: boolean } = {}) {
  const hits = opts.hits ?? HITS;
  let sqlCalled = "";
  let argsCalled: unknown[] = [];
  return {
    $client: {
      prepare: (sql: string) => {
        sqlCalled = sql;
        return {
          all: (...args: unknown[]) => {
            argsCalled = args;
            if (opts.throws) throw new Error("syntax error in fts query");
            return hits;
          },
        };
      },
    },
    _sqlCalled: () => sqlCalled,
    _argsCalled: () => argsCalled,
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { GET } from "./route";

describe("GET /api/chat/conversations/search", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("?q=感情话 返回命中列表 + snippet", async () => {
    const r = await GET(new Request("http://test/api/chat/conversations/search?q=感情话"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { items: Array<{ id: string; snippet: string }>; count: number };
    expect(j.count).toBe(2);
    expect(j.items[0]?.id).toBe("c-1");
    expect(j.items[0]?.snippet).toContain("感情");
  });

  it("FTS query 必须 user_id 限定（防跨用户泄漏）", async () => {
    const fake = makeFakeDb();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(fake);
    await GET(new Request("http://test/api/chat/conversations/search?q=感情话"));
    expect(fake._sqlCalled()).toContain("c.user_id = ?");
    const args = fake._argsCalled() as string[];
    expect(args[0]).toBe("user-1");
    expect(args[1]).toBe("感情话");
  });

  it("?q 空 → 400", async () => {
    const r = await GET(new Request("http://test/api/chat/conversations/search"));
    expect(r.status).toBe(400);
  });

  it("?q 长度 < 3 → 400", async () => {
    const r = await GET(new Request("http://test/api/chat/conversations/search?q=ab"));
    expect(r.status).toBe(400);
  });

  it("?q 长度 > 60 → 400", async () => {
    const r = await GET(
      new Request("http://test/api/chat/conversations/search?q=" + "x".repeat(80)),
    );
    expect(r.status).toBe(400);
  });

  it("FTS5 throw → 400 友好错误", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ throws: true }),
    );
    const r = await GET(
      new Request("http://test/api/chat/conversations/search?q=" + encodeURIComponent("(())")),
    );
    expect(r.status).toBe(400);
  });

  it("limit 固定 20（SQL 含 LIMIT 20）", async () => {
    const fake = makeFakeDb();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(fake);
    await GET(new Request("http://test/api/chat/conversations/search?q=测试词"));
    expect(fake._sqlCalled()).toContain("LIMIT 20");
  });
});
