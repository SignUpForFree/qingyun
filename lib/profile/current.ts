import "server-only";
import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, type Profile } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";

/**
 * 当前档案 cookie 名 — spec §6.4 多档案场景使用，
 * 单档案 MVP 时也作为快速指针，避免每次 select profiles where is_default
 */
export const PROFILE_COOKIE_KEY = "qy_profile_id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getCurrentProfileId(): Promise<string | null> {
  const store = await cookies();
  return store.get(PROFILE_COOKIE_KEY)?.value ?? null;
}

export async function setCurrentProfileId(profileId: string): Promise<void> {
  const store = await cookies();
  store.set(PROFILE_COOKIE_KEY, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}

export async function clearCurrentProfileId(): Promise<void> {
  const store = await cookies();
  store.delete(PROFILE_COOKIE_KEY);
}

/**
 * 读当前用户的当前档案 — 优先 cookie 命中，缺失时退回 profiles.is_default 单 row
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const db = getDb();
  const id = await getCurrentProfileId();

  if (id) {
    const hit = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.user_id, userId)))
      .limit(1);
    if (hit[0]) return hit[0];
  }

  // cookie 缺失或 cookie 指向的档案不属于当前用户 → 退回默认档
  const fallback = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .orderBy(desc(profiles.is_default), desc(profiles.created_at))
    .limit(1);

  return fallback[0] ?? null;
}
