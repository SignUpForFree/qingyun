import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("server-only", () => ({}));

import { getDb } from "@/lib/db/client";
import {
  users,
  profiles,
  conversations,
  messages,
  fortunesDaily,
  fortunesWeekly,
  fortunesMonthly,
} from "@/lib/db/schema";
import {
  parsePillarsCache,
  serializePillars,
  computePillarsFromProfile,
  getOrComputeProfilePillars,
} from "./bazi-pillars";
import type { Profile } from "@/lib/db/schema";

const USER_ID = "u-pillars-test";
const PROFILE_ID = "p-pillars-test";
const NOW = new Date().toISOString();

function makeProfileRow(overrides: Partial<Profile> = {}): Profile {
  return {
    id: PROFILE_ID,
    user_id: USER_ID,
    is_default: true,
    nickname: "我",
    avatar_url: null,
    gender: "male",
    birth_date: "1995-03-22",
    birth_time: "09:00",
    birth_calendar: "solar",
    birth_place: "上海",
    current_address: null,
    bazi_pillars: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

beforeEach(async () => {
  const db = getDb();
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(fortunesDaily);
  await db.delete(fortunesWeekly);
  await db.delete(fortunesMonthly);
  await db.delete(profiles);
  await db.delete(users);
  await db.insert(users).values({ id: USER_ID, created_at: NOW, updated_at: NOW });
});

describe("parsePillarsCache", () => {
  it("空 / null → null", () => {
    expect(parsePillarsCache(null)).toBeNull();
    expect(parsePillarsCache("")).toBeNull();
    expect(parsePillarsCache(undefined)).toBeNull();
  });

  it("非法 JSON → null", () => {
    expect(parsePillarsCache("{not json")).toBeNull();
  });

  it("结构错（缺 solarTrueTime）→ null", () => {
    expect(
      parsePillarsCache(
        JSON.stringify({
          pillars: {
            year: { gan: "甲", zhi: "子" },
            month: { gan: "甲", zhi: "子" },
            day: { gan: "甲", zhi: "子" },
            hour: { gan: "甲", zhi: "子" },
          },
        }),
      ),
    ).toBeNull();
  });

  it("结构错（pillars 非完整四柱）→ null", () => {
    expect(
      parsePillarsCache(
        JSON.stringify({
          pillars: { year: { gan: "甲", zhi: "子" } },
          solarTrueTime: "1990-01-01T04:00:00.000Z",
        }),
      ),
    ).toBeNull();
  });

  it("合法缓存 → 还原对象", () => {
    const cached = {
      pillars: {
        year: { gan: "甲" as const, zhi: "子" as const },
        month: { gan: "甲" as const, zhi: "子" as const },
        day: { gan: "甲" as const, zhi: "子" as const },
        hour: { gan: "甲" as const, zhi: "子" as const },
      },
      solarTrueTime: "1990-01-01T04:00:00.000Z",
    };
    expect(parsePillarsCache(serializePillars(cached))).toEqual(cached);
  });
});

describe("computePillarsFromProfile", () => {
  it("solar profile → 4 柱齐全 + solarTrueTime ISO 字符串", () => {
    const r = computePillarsFromProfile(makeProfileRow());
    expect(r.pillars.year.gan).toBeTruthy();
    expect(r.pillars.year.zhi).toBeTruthy();
    expect(r.pillars.month.gan).toBeTruthy();
    expect(r.pillars.day.gan).toBeTruthy();
    expect(r.pillars.hour.gan).toBeTruthy();
    expect(r.solarTrueTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("lunar profile → pillars 仍齐全", () => {
    const r = computePillarsFromProfile(
      makeProfileRow({ birth_calendar: "lunar", birth_date: "1995-02-22" }),
    );
    expect(r.pillars.year.gan).toBeTruthy();
    expect(r.pillars.month.zhi).toBeTruthy();
  });
});

describe("getOrComputeProfilePillars (M3.15 缓存)", () => {
  it("首次调用：算 + 写回 bazi_pillars 列", async () => {
    const db = getDb();
    await db.insert(profiles).values(makeProfileRow());

    const before = await db
      .select({ raw: profiles.bazi_pillars })
      .from(profiles)
      .where(eq(profiles.id, PROFILE_ID));
    expect(before[0]?.raw).toBeNull();

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, PROFILE_ID));
    const r = getOrComputeProfilePillars(db, profile!);
    expect(r.pillars.year.gan).toBeTruthy();

    const after = await db
      .select({ raw: profiles.bazi_pillars })
      .from(profiles)
      .where(eq(profiles.id, PROFILE_ID));
    expect(after[0]?.raw).toBeTruthy();
    const parsed = parsePillarsCache(after[0]?.raw ?? null);
    expect(parsed).not.toBeNull();
    expect(parsed?.pillars.year.gan).toBe(r.pillars.year.gan);
  });

  it("二次调用：直接读缓存（输出与首次一致）", async () => {
    const db = getDb();
    await db.insert(profiles).values(makeProfileRow());

    const [first] = await db.select().from(profiles).where(eq(profiles.id, PROFILE_ID));
    const r1 = getOrComputeProfilePillars(db, first!);

    const [second] = await db.select().from(profiles).where(eq(profiles.id, PROFILE_ID));
    expect(second!.bazi_pillars).toBeTruthy();
    const r2 = getOrComputeProfilePillars(db, second!);

    expect(r2).toEqual(r1);
  });

  it("缓存损坏（非法 JSON）→ 兜底重算并覆盖", async () => {
    const db = getDb();
    await db.insert(profiles).values(makeProfileRow({ bazi_pillars: "{this is broken" }));
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, PROFILE_ID));
    const r = getOrComputeProfilePillars(db, profile!);
    expect(r.pillars.year.gan).toBeTruthy();

    const after = await db
      .select({ raw: profiles.bazi_pillars })
      .from(profiles)
      .where(eq(profiles.id, PROFILE_ID));
    expect(parsePillarsCache(after[0]?.raw ?? null)).not.toBeNull();
  });
});
