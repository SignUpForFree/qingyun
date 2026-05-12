import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, type Profile } from "@/lib/db/schema";

/**
 * 注：本模块仍是当前 onboarding / api/me/profiles 的直接调用点。
 * 长期方向：调用方迁到 `dataAccess.profiles`（lib/db/data-access-sqlite.ts），
 * 本文件的导出函数保留作为 thin wrapper 不立即废弃。
 *
 * M1.9 多档案 Repository（spec §3.3 A3 / plan §M1.9）
 *
 * - 每个用户至少 1 个档案；默认档由 M1.7 OAuth callback 自动创建（占位数据），
 *   M1.11 onboarding 覆盖。本模块负责后续的多档案 CRUD（增 / 查 / 改 / 删 / 切默认）。
 * - is_default 业务约束「每个 user_id 至多 1 行 is_default = 1」由 setDefault 在事务内保证。
 * - 删除默认档：拒绝（CannotDeleteDefaultProfileError）。用户必须先 PUT 另一档为默认。
 * - 删除非默认档：profiles 行被删，FK 级联：
 *     fortunes_daily / weekly / monthly  ON DELETE CASCADE
 *     conversations.profile_id           ON DELETE SET NULL（保留聊天历史）
 *     messages.profile_id_used           ON DELETE SET NULL
 *
 * 注意：drizzle better-sqlite3 的 transaction 是同步的，callback 不能返 Promise。
 *       所以 atomic swap 用 db.transaction((tx) => { ... .run() ... })，
 *       不要在 callback 内 await。
 */

export interface CreateProfileInput {
  nickname: string;
  avatar_url?: string;
  gender: "male" | "female" | "other";
  birth_date: string; // "YYYY-MM-DD"
  birth_time: string; // "HH:mm"
  birth_calendar?: "solar" | "lunar";
  /** 农历闰月：仅 birth_calendar=lunar 且当年该月为闰月时为 true */
  birth_is_leap_month?: boolean;
  birth_place: string;
  current_address?: string;
}

export type UpdateProfileInput = Partial<
  CreateProfileInput & { is_default: true }
>;

export async function listProfiles(userId: string): Promise<Profile[]> {
  const db = getDb();
  // 默认档优先；同 is_default 下按 created_at 升序（旧档先列）
  return db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .orderBy(desc(profiles.is_default), asc(profiles.created_at));
}

export async function createProfile(
  userId: string,
  input: CreateProfileInput,
): Promise<Profile> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // 用户当前 0 profile → 强制 is_default=true（onboarding 兜底路径必须）
  // 否则保持非默认（多档案路径 / 已有 default 路径不变）
  // 详见 docs/superpowers/specs/2026-05-04-fortune-reading-ai-mcp.md（建档兜底）
  const existingCount = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .limit(1);
  const isDefault = existingCount.length === 0;

  await db.insert(profiles).values({
    id,
    user_id: userId,
    is_default: isDefault,
    nickname: input.nickname,
    avatar_url: input.avatar_url,
    gender: input.gender,
    birth_date: input.birth_date,
    birth_time: input.birth_time,
    birth_calendar: input.birth_calendar ?? "solar",
    birth_is_leap_month: input.birth_is_leap_month ?? false,
    birth_place: input.birth_place,
    current_address: input.current_address,
    created_at: now,
    updated_at: now,
  });

  const [created] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  if (!created) {
    // 极度罕见 — 插入成功但 select 不到（并发删除）
    throw new Error("createProfile: failed to load created row");
  }
  return created;
}

export async function updateProfile(
  userId: string,
  profileId: string,
  patch: UpdateProfileInput,
): Promise<Profile> {
  const db = getDb();
  const { is_default, ...rest } = patch;
  const now = new Date().toISOString();

  if (is_default === true) {
    // Atomic default swap — read+write inside one tx so concurrent default-swaps
    // are serialised by better-sqlite3's single-connection sync semantics:
    //   1. 校验目标档存在且属于当前 user（含 ownership 防越权）
    //   2. 把当前用户所有档 is_default=false
    //   3. 把目标档 is_default=true 同时应用其他字段
    // sync transaction（better-sqlite3）— callback 不能返回 Promise，每条 .run() / .all()。
    db.transaction((tx) => {
      const found = tx
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)))
        .limit(1)
        .all();
      if (found.length === 0) throw new ProfileNotFoundError();
      tx.update(profiles)
        .set({ is_default: false, updated_at: now })
        .where(eq(profiles.user_id, userId))
        .run();
      tx.update(profiles)
        .set({ ...rest, is_default: true, updated_at: now })
        .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)))
        .run();
    });
  } else {
    // 非默认切换的普通字段更新；is_default=false 不接受（避免误把唯一默认档清掉）
    const [existing] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)))
      .limit(1);
    if (!existing) throw new ProfileNotFoundError();

    if (Object.keys(rest).length > 0) {
      await db
        .update(profiles)
        .set({ ...rest, updated_at: now })
        .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)));
    }
  }

  // Final fetch with full ownership filter (review HIGH 1)
  const [updated] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)))
    .limit(1);
  if (!updated) throw new ProfileNotFoundError();
  return updated;
}

export async function deleteProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  const db = getDb();
  const [target] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)))
    .limit(1);
  if (!target) throw new ProfileNotFoundError();
  if (target.is_default) throw new CannotDeleteDefaultProfileError();

  await db
    .delete(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)));
  // FK 自动处理：fortunes_* CASCADE / conversations.profile_id 与 messages.profile_id_used SET NULL
}

export class ProfileNotFoundError extends Error {
  constructor() {
    super("profile not found");
    this.name = "ProfileNotFoundError";
  }
}

export class CannotDeleteDefaultProfileError extends Error {
  constructor() {
    super("cannot delete default profile");
    this.name = "CannotDeleteDefaultProfileError";
  }
}
