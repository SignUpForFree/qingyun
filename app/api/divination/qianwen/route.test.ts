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

interface SlipRow {
  number: number;
  level: "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";
  title: string;
  poem: string;
  default_reading: string;
  category_readings: string;
}

const SLIPS_FIXTURE: SlipRow[] = [
  {
    number: 7,
    level: "上吉",
    title: "渔翁得利",
    poem: "平生学道未尝闲\n鼓吹欢呼柳影间\n今日相逢欢自喜\n明朝富贵亦悠然",
    default_reading: "诸事顺遂",
    category_readings: JSON.stringify({
      综合运势: "整体顺利",
      事业学业: "工作贵人扶持",
      财运: "守正得利",
      感情姻缘: "缘分将至",
      人际贵人: "贵人在远方",
      平安健康: "身心两安",
    }),
  },
];

function makeFakeDb(opts: { ownedConv?: boolean; slips?: SlipRow[] } = {}) {
  const ownedConv = opts.ownedConv ?? true;
  const slipsData = opts.slips ?? SLIPS_FIXTURE;
  let selectCounter = 0;
  let insertCounter = 0;

  // route.ts 调用顺序：
  //   1. select(...).from(conversations).where().limit(1) — conv 校验
  //   2. select().from(slips).where().limit(1) — slip 查找（仅 step 2）
  // 用 selectCounter 区分。

  return {
    select: () => ({
      from: () => {
        const idx = selectCounter++;
        return {
          where: () => ({
            limit: (n: number) => {
              if (idx === 0) {
                // conversations check
                return Promise.resolve(ownedConv ? [{ id: "conv-1" }] : []);
              }
              // slips lookup
              return Promise.resolve(slipsData.slice(0, n));
            },
          }),
        };
      },
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          const id = `msg-${insertCounter++}`;
          return Promise.resolve([{ id, content: "", metadata: null, created_at: "t" }]);
        },
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

describe("POST /api/divination/qianwen — Step 1 (only category)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("提供 category 不带 userQuestion → 写 slip_question_input 卡", async () => {
    const req = new Request("http://test/api/divination/qianwen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "conv-1", category: "事业学业" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { step: string; card: { metadata: string } };
    expect(j.step).toBe("question_input");
    expect(j.card.metadata).toContain("slip_question_input");
    expect(j.card.metadata).toContain("事业学业");
  });

  it("缺 conversationId → 400", async () => {
    const req = new Request("http://test/api/divination/qianwen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "事业学业" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("非法 category（V1.0 旧 '事业' 拒绝）→ 400", async () => {
    const req = new Request("http://test/api/divination/qianwen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "conv-1", category: "事业" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/divination/qianwen — Step 2 (category + userQuestion)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("完整 input → drawSlip + 写 slip_image 卡", async () => {
    // 注意：mock select/from 区分 slips 表通过 _.name；当前 mock 任意调用都返 SLIPS_FIXTURE
    // 实际查 conversations 时 limit 也会走 slipsData fallback — 但因为 mock 返第一行
    // 测试需要明确：本测试 slipsData 包含 slip number=7 (sha256 seed mod 100 + 1 决定具体抽到几)
    // 简化 fixture：只放 slip number=1 让 mock 永远命中
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({
        slips: Array.from({ length: 100 }, (_, i) => ({
          number: i + 1,
          level: "上吉",
          title: `第${i + 1}签`,
          poem: "诗一\n诗二\n诗三\n诗四",
          default_reading: "default",
          category_readings: JSON.stringify({ 事业学业: "事业 reading" }),
        })),
      }),
    );
    const req = new Request("http://test/api/divination/qianwen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: "conv-1",
        category: "事业学业",
        userQuestion: "项目能成吗",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { step: string; card: { metadata: string } };
    expect(j.step).toBe("slip_drawn");
    expect(j.card.metadata).toContain("slip_image");
    expect(j.card.metadata).toContain("imageUrl");
    expect(j.card.metadata).toContain("/api/divination/slip-image/");
  });
});

describe("POST /api/divination/qianwen — error paths", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("非法 JSON → 400", async () => {
    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rate limit → 429", async () => {
    const { checkRateLimit } = await import("@/lib/ai/check-rate-limit");
    (checkRateLimit as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      allowed: false,
      used: 30,
      limit: 30,
    });

    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "conv-1", category: "事业学业" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("conversation 不存在 → 404", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ ownedConv: false }),
    );
    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "wrong", category: "事业学业" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("slip 数据未就绪（M3 seed 前空表）→ 503", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ slips: [] }),
    );
    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: "conv-1",
        category: "事业学业",
        userQuestion: "项目能成吗",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("conversationId nullish (#1 防御) — null 拒绝", async () => {
    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: null, category: "事业学业" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
