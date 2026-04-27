import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  ensureUserId: vi.fn(async () => "user-1"),
}));

interface ConvRow {
  id: string;
  title: string;
  summary: string | null;
  last_intent: string | null;
  last_message_at: string | null;
  created_at: string | null;
}

const NOW = Date.now();
const ISO = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

const ROWS: ConvRow[] = [
  {
    id: "c-today",
    title: "今日对话",
    summary: "今日总结",
    last_intent: "chat",
    last_message_at: ISO(60_000),
    created_at: ISO(60_000),
  },
  {
    id: "c-yesterday",
    title: "昨日",
    summary: null,
    last_intent: "divination",
    last_message_at: ISO(36 * 60 * 60 * 1000),
    created_at: ISO(36 * 60 * 60 * 1000),
  },
  {
    id: "c-week",
    title: "一周内",
    summary: null,
    last_intent: "bazi",
    last_message_at: ISO(5 * 24 * 60 * 60 * 1000),
    created_at: ISO(5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "c-old",
    title: "陈年",
    summary: null,
    last_intent: "dream",
    last_message_at: ISO(30 * 24 * 60 * 60 * 1000),
    created_at: ISO(30 * 24 * 60 * 60 * 1000),
  },
];

const PREVIEW_ROWS = [
  { conversation_id: "c-yesterday", content: "我想问问感情", created_at: ISO(40 * 3600_000) },
  { conversation_id: "c-week", content: "测下八字", created_at: ISO(5.5 * 86_400_000) },
  { conversation_id: "c-old", content: "梦到山", created_at: ISO(31 * 86_400_000) },
];

function makeFakeDb(opts: { rows?: ConvRow[] } = {}) {
  const rows = opts.rows ?? ROWS;
  let selectCounter = 0;
  let inserted: { id: string; title: string } | null = null;
  return {
    select: () => ({
      from: () => {
        const idx = selectCounter++;
        const data = idx === 0 ? rows : PREVIEW_ROWS;
        return {
          where: () => {
            // 链可以 .orderBy(...).limit(...).offset(...) 也可只 .orderBy(...)
            const orderBy = () => {
              const tail = {
                limit: () => ({
                  offset: () => Promise.resolve(data),
                }),
                then: (cb: (v: unknown) => unknown) => Promise.resolve(data).then(cb),
              };
              return tail;
            };
            return { orderBy };
          },
        };
      },
    }),
    insert: () => ({
      values: (v: { id: string; title: string }) => {
        inserted = { id: v.id, title: v.title };
        return Promise.resolve();
      },
    }),
    _inserted: () => inserted,
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { GET, POST } from "./route";

describe("GET /api/chat/conversations", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("列表 ordered + grouped + paged", async () => {
    const r = await GET(new Request("http://test/api/chat/conversations?limit=20&offset=0"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { items: Array<{ id: string; group: string; preview: string }>; limit: number };
    expect(j.limit).toBe(20);
    expect(j.items.length).toBe(4);
    const groups = j.items.map((x) => x.group);
    expect(groups).toContain("today");
    expect(groups).toContain("yesterday");
    expect(groups).toContain("7days");
    expect(groups).toContain("older");
  });

  it("preview = summary 优先", async () => {
    const r = await GET(new Request("http://test/api/chat/conversations"));
    const j = (await r.json()) as { items: Array<{ id: string; preview: string }> };
    const today = j.items.find((x) => x.id === "c-today");
    expect(today?.preview).toBe("今日总结");
  });

  it("preview fallback first user message slice 30", async () => {
    const r = await GET(new Request("http://test/api/chat/conversations"));
    const j = (await r.json()) as { items: Array<{ id: string; preview: string }> };
    const yesterday = j.items.find((x) => x.id === "c-yesterday");
    // 没 summary 就走 messages preview
    expect(yesterday?.preview.length).toBeLessThanOrEqual(30);
  });

  it("非法 limit > 50 → 400", async () => {
    const r = await GET(new Request("http://test/api/chat/conversations?limit=999"));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/chat/conversations", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("空 body → 创建新对话返回 id", async () => {
    const r = await POST(
      new Request("http://test/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "",
      }),
    );
    expect(r.status).toBe(201);
    const j = (await r.json()) as { id: string; title: string };
    expect(j.id).toMatch(/[0-9a-f-]+/);
    expect(j.title).toBe("新对话");
  });

  it("传 title → 用之", async () => {
    const r = await POST(
      new Request("http://test/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "事业占卜" }),
      }),
    );
    expect(r.status).toBe(201);
    const j = (await r.json()) as { title: string };
    expect(j.title).toBe("事业占卜");
  });

  it("非法 JSON → 400", async () => {
    const r = await POST(
      new Request("http://test/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(r.status).toBe(400);
  });

  it("title 超长（>60）→ 400", async () => {
    const r = await POST(
      new Request("http://test/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x".repeat(70) }),
      }),
    );
    expect(r.status).toBe(400);
  });
});
