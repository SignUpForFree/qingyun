import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

vi.mock("server-only", () => ({}));

const adminFns = {
  selectMaybeSingle: vi.fn<() => Promise<{ data: { id: string } | null }>>(),
  insert: vi.fn<() => Promise<{ error: { message: string } | null }>>(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => adminFns.selectMaybeSingle(),
        }),
      }),
      insert: (row: unknown) => adminFns.insert(row as never),
    }),
  }),
}));

import { ensureBaziChart } from "./ensure-bazi";

const VALID_PROFILE: Profile = {
  id: "p1",
  user_id: "u1",
  nickname: "test",
  gender: "male",
  birth_time: "1990-06-15T14:30:00+08:00",
  calendar_type: "solar",
  birth_province: "浙江",
  birth_city: "杭州",
  birth_district: null,
  birth_longitude: 120.1551,
  birth_latitude: 30.2741,
  current_location: null,
  avatar_url: null,
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("ensureBaziChart", () => {
  beforeEach(() => {
    adminFns.selectMaybeSingle.mockReset();
    adminFns.insert.mockReset();
  });

  it("已有 bazi_charts → 早返回 (idempotent)", async () => {
    adminFns.selectMaybeSingle.mockResolvedValue({ data: { id: "existing" } });
    await ensureBaziChart(VALID_PROFILE);
    expect(adminFns.insert).not.toHaveBeenCalled();
  });

  it("无 bazi_charts → 调 buildChart 后写入", async () => {
    adminFns.selectMaybeSingle.mockResolvedValue({ data: null });
    adminFns.insert.mockResolvedValue({ error: null });
    await ensureBaziChart(VALID_PROFILE);
    expect(adminFns.insert).toHaveBeenCalledTimes(1);
    const row = adminFns.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.profile_id).toBe("p1");
    expect(row.day_master).toBe("辛"); // C4 baseline
  });

  it("缺 birth_time 抛错", async () => {
    adminFns.selectMaybeSingle.mockResolvedValue({ data: null });
    await expect(
      ensureBaziChart({ ...VALID_PROFILE, birth_time: null }),
    ).rejects.toThrow(/birth_time/);
  });

  it("缺 birth_longitude 抛错", async () => {
    adminFns.selectMaybeSingle.mockResolvedValue({ data: null });
    await expect(
      ensureBaziChart({ ...VALID_PROFILE, birth_longitude: null }),
    ).rejects.toThrow(/birth_longitude/);
  });

  it("缺 gender 抛错", async () => {
    adminFns.selectMaybeSingle.mockResolvedValue({ data: null });
    await expect(
      ensureBaziChart({ ...VALID_PROFILE, gender: null }),
    ).rejects.toThrow(/gender/);
  });

  it("supabase insert 错误时抛错", async () => {
    adminFns.selectMaybeSingle.mockResolvedValue({ data: null });
    adminFns.insert.mockResolvedValue({ error: { message: "constraint violation" } });
    await expect(ensureBaziChart(VALID_PROFILE)).rejects.toThrow(/constraint violation/);
  });
});
