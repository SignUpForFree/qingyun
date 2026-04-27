import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireUserId: vi.fn(),
  };
});

vi.mock("@/lib/profile/repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/profile/repository")>();
  return {
    ...actual,
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
  };
});

import { GET, POST } from "./route";
import { PUT, DELETE } from "./[id]/route";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  ProfileNotFoundError,
  CannotDeleteDefaultProfileError,
} from "@/lib/profile/repository";

/**
 * M1.9 Route 测试 — 8 必填路径 + 校验细节
 *
 * 单元化策略：mock auth + repository，让 route 只剩 schema + status 转换逻辑。
 * （DB / FK / 事务行为由 lib/profile/repository.test.ts 覆盖）
 */

const USER_ID = "u-test-1";

const PROFILE_FIXTURE = {
  id: "p-1",
  user_id: USER_ID,
  is_default: true,
  nickname: "默认",
  avatar_url: null,
  gender: "other" as const,
  birth_date: "1990-01-01",
  birth_time: "12:00",
  birth_calendar: "solar" as const,
  birth_place: "未填",
  current_address: null,
  bazi_pillars: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUserId).mockResolvedValue(USER_ID);
});

describe("GET /api/me/profiles", () => {
  it("returns list from repository.listProfiles", async () => {
    const list = [PROFILE_FIXTURE, { ...PROFILE_FIXTURE, id: "p-2", is_default: false }];
    vi.mocked(listProfiles).mockResolvedValue(list);

    const r = await GET();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe("p-1");
    expect(vi.mocked(listProfiles)).toHaveBeenCalledWith(USER_ID);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUserId).mockRejectedValueOnce(new UnauthenticatedError());
    const r = await GET();
    expect(r.status).toBe(401);
  });
});

describe("POST /api/me/profiles", () => {
  const VALID_BODY = {
    nickname: "妻子",
    gender: "female",
    birth_date: "1992-05-05",
    birth_time: "10:00",
    birth_calendar: "solar",
    birth_place: "上海",
  };

  function makeReq(body: unknown) {
    return new Request("http://test/api/me/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("creates profile with is_default=false (returns 201 + data)", async () => {
    const created = {
      ...PROFILE_FIXTURE,
      id: "p-new",
      is_default: false,
      nickname: "妻子",
      gender: "female" as const,
      birth_date: "1992-05-05",
      birth_time: "10:00",
      birth_place: "上海",
    };
    vi.mocked(createProfile).mockResolvedValueOnce(created);

    const r = await POST(makeReq(VALID_BODY));
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.data.id).toBe("p-new");
    expect(body.data.is_default).toBe(false);
    expect(body.data.nickname).toBe("妻子");

    expect(vi.mocked(createProfile)).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        nickname: "妻子",
        gender: "female",
        birth_date: "1992-05-05",
        birth_time: "10:00",
        birth_calendar: "solar",
        birth_place: "上海",
      }),
    );
  });

  it("rejects invalid JSON with 400", async () => {
    const r = await POST(makeReq("not-json"));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("invalid_json");
    expect(vi.mocked(createProfile)).not.toHaveBeenCalled();
  });

  it.each([
    ["nickname", { ...VALID_BODY, nickname: undefined }],
    ["gender", { ...VALID_BODY, gender: undefined }],
    ["birth_date", { ...VALID_BODY, birth_date: undefined }],
    ["birth_time", { ...VALID_BODY, birth_time: undefined }],
    ["birth_place", { ...VALID_BODY, birth_place: undefined }],
  ])("rejects missing %s with 400 (validation)", async (_field, body) => {
    const r = await POST(makeReq(body));
    expect(r.status).toBe(400);
    const json = await r.json();
    expect(json.error).toBe("validation");
    expect(vi.mocked(createProfile)).not.toHaveBeenCalled();
  });

  it("rejects bad birth_date format", async () => {
    const r = await POST(makeReq({ ...VALID_BODY, birth_date: "1992/05/05" }));
    expect(r.status).toBe(400);
  });

  it("rejects bad birth_time format", async () => {
    const r = await POST(makeReq({ ...VALID_BODY, birth_time: "10:00:00" }));
    expect(r.status).toBe(400);
  });

  it("rejects invalid gender enum", async () => {
    const r = await POST(makeReq({ ...VALID_BODY, gender: "unknown" }));
    expect(r.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUserId).mockRejectedValueOnce(new UnauthenticatedError());
    const r = await POST(makeReq(VALID_BODY));
    expect(r.status).toBe(401);
  });
});

describe("PUT /api/me/profiles/[id]", () => {
  function makeReq(body: unknown) {
    return new Request("http://test/api/me/profiles/p-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  function makeCtx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("updates allowed fields and returns updated row", async () => {
    const updated = { ...PROFILE_FIXTURE, nickname: "新昵称", birth_place: "杭州" };
    vi.mocked(updateProfile).mockResolvedValueOnce(updated);

    const r = await PUT(makeReq({ nickname: "新昵称", birth_place: "杭州" }), makeCtx("p-1"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.nickname).toBe("新昵称");
    expect(body.data.birth_place).toBe("杭州");

    expect(vi.mocked(updateProfile)).toHaveBeenCalledWith(USER_ID, "p-1", {
      nickname: "新昵称",
      birth_place: "杭州",
    });
  });

  it("with is_default=true forwards through to repository (atomic swap responsibility)", async () => {
    const updated = { ...PROFILE_FIXTURE, id: "p-2", is_default: true };
    vi.mocked(updateProfile).mockResolvedValueOnce(updated);

    const r = await PUT(makeReq({ is_default: true }), makeCtx("p-2"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.id).toBe("p-2");
    expect(body.data.is_default).toBe(true);

    expect(vi.mocked(updateProfile)).toHaveBeenCalledWith(USER_ID, "p-2", {
      is_default: true,
    });
  });

  it("strips disallowed fields (id / user_id / created_at)", async () => {
    vi.mocked(updateProfile).mockResolvedValueOnce(PROFILE_FIXTURE);

    await PUT(
      makeReq({
        nickname: "x",
        id: "evil-id",
        user_id: "evil-user",
        created_at: "2000-01-01",
        bazi_pillars: '{"hacked":true}',
      }),
      makeCtx("p-1"),
    );

    const passed = vi.mocked(updateProfile).mock.calls[0][2];
    expect(passed).toEqual({ nickname: "x" });
    expect(passed).not.toHaveProperty("id");
    expect(passed).not.toHaveProperty("user_id");
    expect(passed).not.toHaveProperty("created_at");
    expect(passed).not.toHaveProperty("bazi_pillars");
  });

  it("rejects is_default=false (only true is meaningful)", async () => {
    const r = await PUT(makeReq({ is_default: false }), makeCtx("p-1"));
    expect(r.status).toBe(400);
    expect(vi.mocked(updateProfile)).not.toHaveBeenCalled();
  });

  it("returns 404 when profile not found", async () => {
    vi.mocked(updateProfile).mockRejectedValueOnce(new ProfileNotFoundError());
    const r = await PUT(makeReq({ nickname: "x" }), makeCtx("p-missing"));
    expect(r.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUserId).mockRejectedValueOnce(new UnauthenticatedError());
    const r = await PUT(makeReq({ nickname: "x" }), makeCtx("p-1"));
    expect(r.status).toBe(401);
  });

  it("rejects invalid JSON with 400", async () => {
    const r = await PUT(makeReq("not-json"), makeCtx("p-1"));
    expect(r.status).toBe(400);
  });
});

describe("DELETE /api/me/profiles/[id]", () => {
  function makeReq() {
    return new Request("http://test/api/me/profiles/p-1", { method: "DELETE" });
  }
  function makeCtx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("returns 204 on success", async () => {
    vi.mocked(deleteProfile).mockResolvedValueOnce(undefined);
    const r = await DELETE(makeReq(), makeCtx("p-extra"));
    expect(r.status).toBe(204);
    expect(vi.mocked(deleteProfile)).toHaveBeenCalledWith(USER_ID, "p-extra");
  });

  it("returns 400 with clear error when trying to delete default profile", async () => {
    vi.mocked(deleteProfile).mockRejectedValueOnce(new CannotDeleteDefaultProfileError());
    const r = await DELETE(makeReq(), makeCtx("p-default"));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("cannot_delete_default_profile");
    expect(typeof body.message).toBe("string");
  });

  it("returns 404 when profile not found", async () => {
    vi.mocked(deleteProfile).mockRejectedValueOnce(new ProfileNotFoundError());
    const r = await DELETE(makeReq(), makeCtx("p-nonexistent"));
    expect(r.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUserId).mockRejectedValueOnce(new UnauthenticatedError());
    const r = await DELETE(makeReq(), makeCtx("p-1"));
    expect(r.status).toBe(401);
  });
});
