import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

vi.mock("server-only", () => ({}));

let testDb: BetterSQLite3Database<typeof schema>;
let testSqlite: Database.Database;

vi.mock("@/lib/db/client", () => ({
  getDb: () => testDb,
}));

import { ensureBaziChart } from "./ensure-bazi";
import type { Profile } from "@/lib/db/schema";

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

beforeEach(async () => {
  testSqlite = new Database(":memory:");
  testSqlite.pragma("foreign_keys = OFF"); // 跳过 profile 表插入要求
  testDb = drizzle(testSqlite, { schema });
  migrate(testDb, { migrationsFolder: path.resolve(process.cwd(), "db/migrations-sqlite") });
});

describe("ensureBaziChart", () => {
  it("已有 bazi_charts → 早返回 (idempotent)", async () => {
    // 先插一条 bazi_charts
    await testDb.insert(schema.baziCharts).values({
      profile_id: "p1",
      pillars: "{}",
      five_elements: "{}",
      day_master: "甲",
      ten_gods: "{}",
      solar_true_time: "2020-01-01T00:00:00+08:00",
    });
    await ensureBaziChart(VALID_PROFILE);
    // 仍然只有 1 条
    const all = await testDb.select().from(schema.baziCharts).where(eq(schema.baziCharts.profile_id, "p1"));
    expect(all.length).toBe(1);
    expect(all[0].day_master).toBe("甲"); // 没被覆盖
  });

  it("无 bazi_charts → 调 buildChart 后写入", async () => {
    await ensureBaziChart(VALID_PROFILE);
    const all = await testDb.select().from(schema.baziCharts).where(eq(schema.baziCharts.profile_id, "p1"));
    expect(all.length).toBe(1);
    expect(all[0].day_master).toBe("辛"); // C4 baseline
    const pillars = JSON.parse(all[0].pillars);
    expect(pillars.year.gan).toBe("庚");
  });

  it("缺 birth_time 抛错", async () => {
    await expect(
      ensureBaziChart({ ...VALID_PROFILE, birth_time: null }),
    ).rejects.toThrow(/birth_time/);
  });

  it("缺 birth_longitude 抛错", async () => {
    await expect(
      ensureBaziChart({ ...VALID_PROFILE, birth_longitude: null }),
    ).rejects.toThrow(/birth_longitude/);
  });

  it("缺 gender 抛错", async () => {
    await expect(
      ensureBaziChart({ ...VALID_PROFILE, gender: null }),
    ).rejects.toThrow(/gender/);
  });
});
