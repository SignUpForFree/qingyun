import { describe, it, expect, beforeEach, vi } from "vitest";
import { and, eq } from "drizzle-orm";

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
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  ProfileNotFoundError,
  CannotDeleteDefaultProfileError,
} from "./repository";

/**
 * M1.9 lib/profile/repository — 多档案 CRUD 单测
 *
 * 共享 dev.db（V2.0 schema 已在）模式，跟 fts5.test.ts / wechat callback test 一致。
 * 每个测试 beforeEach 清干净 messages → conversations → fortunes_* → profiles → users
 * （按 FK 顺序，先子后父；fortunes_* 是 profiles 的子，conversations 也是 profiles 的子）。
 */

const USER_A = "u-prof-test-a";
const USER_B = "u-prof-test-b";

const NOW = new Date().toISOString();

const BASE_INPUT = {
  nickname: "测试档案",
  gender: "female" as const,
  birth_date: "1995-03-14",
  birth_time: "09:30",
  birth_calendar: "solar" as const,
  birth_place: "上海",
};

beforeEach(async () => {
  const db = getDb();
  // 按 FK 顺序：messages → conversations / fortunes_* → profiles → users
  // （只清测试用户的；其他用户数据保持，避免相互冲突）
  await db.delete(messages); // FK conv，先全清最稳
  await db.delete(conversations);
  await db.delete(fortunesDaily);
  await db.delete(fortunesWeekly);
  await db.delete(fortunesMonthly);
  await db.delete(profiles);
  await db.delete(users);

  await db.insert(users).values({ id: USER_A, created_at: NOW, updated_at: NOW });
  await db.insert(users).values({ id: USER_B, created_at: NOW, updated_at: NOW });
});

describe("listProfiles", () => {
  it("returns ordered by is_default DESC, created_at ASC", async () => {
    const db = getDb();
    const t0 = "2026-01-01T00:00:00.000Z";
    const t1 = "2026-02-01T00:00:00.000Z";
    const t2 = "2026-03-01T00:00:00.000Z";

    // 老的非默认（应排第 2）
    await db.insert(profiles).values({
      id: "p-old-non-default",
      user_id: USER_A,
      is_default: false,
      nickname: "老",
      gender: "female",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "北京",
      created_at: t0,
      updated_at: t0,
    });
    // 新的默认（应排第 1）
    await db.insert(profiles).values({
      id: "p-new-default",
      user_id: USER_A,
      is_default: true,
      nickname: "默认",
      gender: "male",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "北京",
      created_at: t1,
      updated_at: t1,
    });
    // 更新的非默认（应排第 3）
    await db.insert(profiles).values({
      id: "p-newer-non-default",
      user_id: USER_A,
      is_default: false,
      nickname: "更新的",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "北京",
      created_at: t2,
      updated_at: t2,
    });
    // 别的用户的默认（不应出现）
    await db.insert(profiles).values({
      id: "p-other-user",
      user_id: USER_B,
      is_default: true,
      nickname: "他人",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "北京",
      created_at: t0,
      updated_at: t0,
    });

    const list = await listProfiles(USER_A);
    expect(list.map((p) => p.id)).toEqual([
      "p-new-default",
      "p-old-non-default",
      "p-newer-non-default",
    ]);
  });

  it("returns empty array when user has no profiles", async () => {
    const list = await listProfiles(USER_A);
    expect(list).toEqual([]);
  });
});

describe("createProfile", () => {
  it("creates new profile with is_default=false", async () => {
    // 先建一个默认档（模拟 M1.7 OAuth callback 创建）
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-default",
      user_id: USER_A,
      is_default: true,
      nickname: "默认",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });

    const created = await createProfile(USER_A, {
      ...BASE_INPUT,
      nickname: "妻子",
    });

    expect(created.user_id).toBe(USER_A);
    expect(created.is_default).toBe(false);
    expect(created.nickname).toBe("妻子");
    expect(created.gender).toBe("female");
    expect(created.birth_calendar).toBe("solar");

    // 默认档仍是默认（POST 不影响）
    const list = await listProfiles(USER_A);
    expect(list).toHaveLength(2);
    const defaults = list.filter((p) => p.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("p-default");
  });

  it("uses default birth_calendar=solar when omitted", async () => {
    const created = await createProfile(USER_A, {
      nickname: "x",
      gender: "male",
      birth_date: "2000-01-01",
      birth_time: "12:00",
      birth_place: "天津",
    });
    expect(created.birth_calendar).toBe("solar");
  });
});

describe("updateProfile", () => {
  it("updates allowed fields and bumps updated_at", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-1",
      user_id: USER_A,
      is_default: true,
      nickname: "原昵称",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const updated = await updateProfile(USER_A, "p-1", {
      nickname: "新昵称",
      birth_place: "杭州",
      gender: "female",
    });

    expect(updated.nickname).toBe("新昵称");
    expect(updated.birth_place).toBe("杭州");
    expect(updated.gender).toBe("female");
    expect(updated.id).toBe("p-1");
    expect(updated.user_id).toBe(USER_A);
    expect(updated.is_default).toBe(true); // 保留
    expect(updated.updated_at > "2026-01-01T00:00:00.000Z").toBe(true);
  });

  it("throws ProfileNotFoundError when profile does not belong to user", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-other",
      user_id: USER_B,
      is_default: true,
      nickname: "x",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });
    await expect(updateProfile(USER_A, "p-other", { nickname: "x" })).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });

  it("PUT is_default=true on a non-existent id throws ProfileNotFoundError without disturbing existing default", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-a",
      user_id: USER_A,
      is_default: true,
      nickname: "原默认",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });

    await expect(
      updateProfile(USER_A, "id-that-does-not-exist", { is_default: true }),
    ).rejects.toBeInstanceOf(ProfileNotFoundError);

    // 原默认档仍是默认，且唯一
    const list = await listProfiles(USER_A);
    const defaults = list.filter((p) => p.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("p-a");
  });

  it("atomically swaps is_default to a different profile", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-a",
      user_id: USER_A,
      is_default: true,
      nickname: "原默认",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });
    await db.insert(profiles).values({
      id: "p-b",
      user_id: USER_A,
      is_default: false,
      nickname: "副档",
      gender: "female",
      birth_date: "1992-05-05",
      birth_time: "10:00",
      birth_calendar: "solar",
      birth_place: "上海",
      created_at: NOW,
      updated_at: NOW,
    });

    const updated = await updateProfile(USER_A, "p-b", { is_default: true });
    expect(updated.id).toBe("p-b");
    expect(updated.is_default).toBe(true);

    // 同用户下 is_default=true 恰好 1 行，且是 p-b
    const all = await db
      .select()
      .from(profiles)
      .where(eq(profiles.user_id, USER_A));
    const defaults = all.filter((p) => p.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("p-b");

    // p-a 已变非默认
    const aAfter = all.find((p) => p.id === "p-a");
    expect(aAfter?.is_default).toBe(false);
  });
});

describe("deleteProfile", () => {
  it("deletes a non-default profile and SET NULL on conversations", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-default",
      user_id: USER_A,
      is_default: true,
      nickname: "默认",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });
    await db.insert(profiles).values({
      id: "p-spouse",
      user_id: USER_A,
      is_default: false,
      nickname: "妻子",
      gender: "female",
      birth_date: "1992-05-05",
      birth_time: "10:00",
      birth_calendar: "solar",
      birth_place: "上海",
      created_at: NOW,
      updated_at: NOW,
    });

    // 一条引用 p-spouse 的 conversation
    await db.insert(conversations).values({
      id: "c-1",
      user_id: USER_A,
      profile_id: "p-spouse",
      title: "聊天",
      created_at: NOW,
    });

    await deleteProfile(USER_A, "p-spouse");

    const remaining = await db
      .select()
      .from(profiles)
      .where(eq(profiles.user_id, USER_A));
    expect(remaining.map((p) => p.id)).toEqual(["p-default"]);

    // conversations.profile_id SET NULL
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, "c-1"));
    expect(conv[0].profile_id).toBeNull();
  });

  it("rejects delete of the default profile", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-default",
      user_id: USER_A,
      is_default: true,
      nickname: "默认",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });

    await expect(deleteProfile(USER_A, "p-default")).rejects.toBeInstanceOf(
      CannotDeleteDefaultProfileError,
    );
    // 没动表
    const all = await db.select().from(profiles).where(eq(profiles.user_id, USER_A));
    expect(all).toHaveLength(1);
  });

  it("cascades fortunes_daily/weekly/monthly", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-default",
      user_id: USER_A,
      is_default: true,
      nickname: "默认",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });
    await db.insert(profiles).values({
      id: "p-extra",
      user_id: USER_A,
      is_default: false,
      nickname: "副档",
      gender: "female",
      birth_date: "1995-01-01",
      birth_time: "12:00",
      birth_calendar: "solar",
      birth_place: "深圳",
      created_at: NOW,
      updated_at: NOW,
    });

    await db.insert(fortunesDaily).values({
      profile_id: "p-extra",
      date: "2026-04-27",
      overall: 80,
      scores: "{}",
      one_liner: "x",
      attributes: "{}",
      reading: "x",
    });
    await db.insert(fortunesWeekly).values({
      profile_id: "p-extra",
      week_start: "2026-04-27",
      overall: 70,
      scores: "{}",
      one_liner: null,
      reading: null,
    });
    await db.insert(fortunesMonthly).values({
      profile_id: "p-extra",
      month: "2026-04",
      overall: 65,
      scores: "{}",
      one_liner: null,
      reading: null,
    });

    await deleteProfile(USER_A, "p-extra");

    const d = await db
      .select()
      .from(fortunesDaily)
      .where(eq(fortunesDaily.profile_id, "p-extra"));
    const w = await db
      .select()
      .from(fortunesWeekly)
      .where(eq(fortunesWeekly.profile_id, "p-extra"));
    const m = await db
      .select()
      .from(fortunesMonthly)
      .where(eq(fortunesMonthly.profile_id, "p-extra"));
    expect(d).toHaveLength(0);
    expect(w).toHaveLength(0);
    expect(m).toHaveLength(0);
  });

  it("throws ProfileNotFoundError when profile does not belong to user", async () => {
    const db = getDb();
    await db.insert(profiles).values({
      id: "p-foreign",
      user_id: USER_B,
      is_default: true,
      nickname: "x",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "00:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: NOW,
      updated_at: NOW,
    });
    await expect(deleteProfile(USER_A, "p-foreign")).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
    // 别人档案没被删
    const still = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, "p-foreign"), eq(profiles.user_id, USER_B)));
    expect(still).toHaveLength(1);
  });
});
