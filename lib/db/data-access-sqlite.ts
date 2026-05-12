import "server-only";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./client";
import { messages, profiles, type Message, type Profile } from "./schema";
import {
  CannotDeleteDefaultProfileError,
  ProfileNotFoundError,
} from "@/lib/profile/repository";
import type {
  CreateProfileInput,
  DataAccess,
  InsertMessageInput,
  MessageRepo,
  ProfileRepo,
  UpdateProfileInput,
} from "./data-access";

class SqliteProfileRepo implements ProfileRepo {
  async list(userId: string): Promise<Profile[]> {
    const db = getDb();
    return db
      .select()
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .orderBy(desc(profiles.is_default), asc(profiles.created_at));
  }

  async findDefault(userId: string): Promise<Profile | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.user_id, userId), eq(profiles.is_default, true)))
      .limit(1);
    return row ?? null;
  }

  async create(userId: string, input: CreateProfileInput): Promise<Profile> {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // 用户当前 0 profile → 强制 is_default=true（onboarding 兜底必须）
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
    if (!created) throw new Error("createProfile: failed to load created row");
    return created;
  }

  async update(
    userId: string,
    profileId: string,
    patch: UpdateProfileInput,
  ): Promise<Profile> {
    const db = getDb();
    const { is_default, ...rest } = patch;
    const now = new Date().toISOString();

    if (is_default === true) {
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

    const [updated] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)))
      .limit(1);
    if (!updated) throw new ProfileNotFoundError();
    return updated;
  }

  async delete(userId: string, profileId: string): Promise<void> {
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
  }
}

class SqliteMessageRepo implements MessageRepo {
  async insert(input: InsertMessageInput): Promise<Message> {
    const db = getDb();
    const [row] = await db
      .insert(messages)
      .values(input)
      .returning();
    if (!row) throw new Error("insertMessage: empty returning");
    return row;
  }

  async recent(conversationId: string, limit: number): Promise<Message[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversation_id, conversationId))
      .orderBy(desc(messages.created_at))
      .limit(limit);
    return rows.reverse();
  }

  async countUserSince(
    conversationId: string,
    sinceIso: string,
  ): Promise<number> {
    const db = getDb();
    const r = await db
      .select({ n: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversation_id, conversationId),
          eq(messages.role, "user"),
          gte(messages.created_at, sinceIso),
        ),
      );
    return r[0]?.n ?? 0;
  }
}

export class SqliteDataAccess implements DataAccess {
  readonly profiles: ProfileRepo = new SqliteProfileRepo();
  readonly messages: MessageRepo = new SqliteMessageRepo();
}

declare global {
  var __qingyun_data_access__: DataAccess | undefined;
}

export const dataAccess: DataAccess =
  globalThis.__qingyun_data_access__ ?? new SqliteDataAccess();
if (!globalThis.__qingyun_data_access__) {
  globalThis.__qingyun_data_access__ = dataAccess;
}
