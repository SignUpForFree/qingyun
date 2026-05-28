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

  it("intent=dream → 直接输出梦境描述引导（无选择卡）", async () => {
    const card = await buildGuideCard("dream", "u-1", "c-1");
    expect(card.meta.ui).toBe("text");
    expect((card.meta as { dreamAwaitingInput?: boolean }).dreamAwaitingInput).toBe(true);
    expect(card.contentText).toContain("请描述你的梦境内容");
  });

  it("intent=chat → 空 text fallback (不应被路由调用)", async () => {
    const card = await buildGuideCard("chat", "u-1", "c-1");
    expect(card.meta.ui).toBe("text");
  });
});

/**
 * Mock 两种 select 链式：
 *   - listUserProfiles: select().from().where() 直接 await（thenable）
 *   - getConversationProfileId: select().from().where().limit(1) await
 *
 * boundProfileId 给定 → conversation.profile_id 视为已绑定该 id；null → 未绑定。
 */
function mockProfiles(
  rows: typeof profilesFixture,
  boundProfileId: string | null = null,
) {
  dbMock.select.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(
          boundProfileId ? [{ profile_id: boundProfileId }] : [],
        ),
        then: (resolve: (v: typeof rows) => unknown) =>
          Promise.resolve(rows).then(resolve),
      }),
    }),
  }));
}

describe("buildGuideCard intent=bazi - profile branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无任何 profile → bazi_quick_form", async () => {
    mockProfiles([]);
    const card = await buildGuideCard("bazi", "u-1", "c-1");
    expect(card.meta.ui).toBe("bazi_quick_form");
  });

  it("仅 1 个 profile → 跳过 picker 直接 bazi_focus_picker", async () => {
    mockProfiles([
      {
        id: "p-1",
        nickname: "我",
        isDefault: true,
        gender: "male",
        birthDate: "1990-01-01",
      },
    ]);
    const card = await buildGuideCard("bazi", "u-1", "c-1");
    expect(card.meta.ui).toBe("bazi_focus_picker");
    expect(card.meta.profileId).toBe("p-1");
  });

  it("2+ profile → profile_picker 含 intent=bazi", async () => {
    mockProfiles([
      { id: "p-1", nickname: "我", isDefault: true, gender: "male", birthDate: null },
      { id: "p-2", nickname: "我妈", isDefault: false, gender: "female", birthDate: null },
    ]);
    const card = await buildGuideCard("bazi", "u-1", "c-1");
    expect(card.meta.ui).toBe("profile_picker");
    expect(card.meta.intent).toBe("bazi");
  });

  it("2+ profile + 会话已绑定档案 → 跳过 picker 直接 focus_picker", async () => {
    mockProfiles(
      [
        { id: "p-1", nickname: "我", isDefault: true, gender: "male", birthDate: null },
        { id: "p-2", nickname: "我妈", isDefault: false, gender: "female", birthDate: null },
      ],
      "p-2",
    );
    const card = await buildGuideCard("bazi", "u-1", "c-1");
    expect(card.meta.ui).toBe("bazi_focus_picker");
    expect(card.meta.profileId).toBe("p-2");
  });
});

describe("buildGuideCard intent=meihua - profile branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无任何 profile → bazi_quick_form (引导先建档)", async () => {
    mockProfiles([]);
    const card = await buildGuideCard("meihua", "u-1", "c-1");
    expect(card.meta.ui).toBe("bazi_quick_form");
  });

  it("仅 1 个 profile → 跳过 picker 直接 meihua_number_input", async () => {
    mockProfiles([
      {
        id: "p-1",
        nickname: "我",
        isDefault: true,
        gender: "male",
        birthDate: "1990-01-01",
      },
    ]);
    const card = await buildGuideCard("meihua", "u-1", "c-1");
    expect(card.meta.ui).toBe("meihua_number_input");
    expect(card.meta.profileId).toBe("p-1");
  });

  it("2+ profile → profile_picker 含 intent=meihua", async () => {
    mockProfiles([
      { id: "p-1", nickname: "我", isDefault: true, gender: "male", birthDate: null },
      { id: "p-2", nickname: "我爸", isDefault: false, gender: "male", birthDate: null },
    ]);
    const card = await buildGuideCard("meihua", "u-1", "c-1");
    expect(card.meta.ui).toBe("profile_picker");
    expect(card.meta.intent).toBe("meihua");
  });

  it("2+ profile + 会话已绑定档案 → 跳过 picker 直接 number_input", async () => {
    mockProfiles(
      [
        { id: "p-1", nickname: "我", isDefault: true, gender: "male", birthDate: null },
        { id: "p-2", nickname: "我爸", isDefault: false, gender: "male", birthDate: null },
      ],
      "p-1",
    );
    const card = await buildGuideCard("meihua", "u-1", "c-1");
    expect(card.meta.ui).toBe("meihua_number_input");
    expect(card.meta.profileId).toBe("p-1");
  });
});

// Note: writeAndStreamCard / streamChatReply / routeIntent 涉及完整 DB 写入 +
// AI stream 状态机，单元测试成本高。/api/chat/route.test.ts 做端到端覆盖
// 更合适，本文件只覆盖纯卡片构造分支。
