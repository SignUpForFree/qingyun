import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const id = await getCurrentProfileId();
  if (id) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) return data;
  }

  // cookie 缺失或 cookie 指向的档案已删/不属于当前用户 → 退回默认档
  const { data: fallback } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return fallback ?? null;
}
