import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock DB before imports — routeIntent reads/writes through getDb()
const dbMock = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "card-id-1" }]),
    }),
  }),
  select: vi.fn(),
};

let profilesFixture: Array<{
  id: string;
  nickname: string;
  isDefault: boolean;
  gender: "male" | "female" | "other";
  birthDate: string | null;
}> = [];

dbMock.select.mockImplementation(() => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(profilesFixture.slice(0, 1)),
    }),
  }),
}));

// Override profiles list query
const fullProfilesChain = {
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(profilesFixture),
  }),
};

vi.mock("@/lib/db/client", () => ({
  getDb: () => dbMock,
}));

vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(),
}));

vi.mock("@/lib/ai/summarizer", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/lib/ai/summarizer");
  return {
    ...actual,
    K_RECENT: 6,
    buildPromptMessages: vi.fn().mockReturnValue([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]),
  };
});

import { buildGuideCard } from "./router";

describe("buildGuideCard (M2.15 dispatch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profilesFixture = [];
  });

  it("intent=divination → slip_type_picker with 6 categories", async () => {
    const card = await buildGuideCard("divination", "u-1", "c-1");
    expect(card.meta.ui).toBe("slip_type_picker");
    expect((card.meta.options as unknown[]).length).toBe(6);
    expect(card.contentText).toMatch(/求/);
  });

  it("intent=dream → dream_choice (fast/precise)", async () => {
    const card = await buildGuideCard("dream", "u-1", "c-1");
    expect(card.meta.ui).toBe("dream_choice");
    const opts = card.meta.options as Array<{ key: string; label: string }>;
    expect(opts).toHaveLength(2);
    expect(opts.map((o) => o.key)).toEqual(["fast", "precise"]);
  });

  it("intent=chat → 空 text fallback (不应被路由调用)", async () => {
    const card = await buildGuideCard("chat", "u-1", "c-1");
    expect(card.meta.ui).toBe("text");
  });
});

describe("buildGuideCard intent=bazi - profile branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无任何 profile → bazi_quick_form", async () => {
    profilesFixture = [];
    dbMock.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const card = await buildGuideCard("bazi", "u-1", "c-1");
    expect(card.meta.ui).toBe("bazi_quick_form");
  });
});

describe("buildGuideCard intent=meihua - profile branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无任何 profile → bazi_quick_form (引导先建档)", async () => {
    dbMock.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const card = await buildGuideCard("meihua", "u-1", "c-1");
    expect(card.meta.ui).toBe("bazi_quick_form");
  });
});

// Note: writeAndStreamCard / streamChatReply / routeIntent 涉及完整 DB 写入 +
// AI stream 状态机，单元测试成本高。/api/chat/route.test.ts 做端到端覆盖
// 更合适，本文件只覆盖纯卡片构造分支。
