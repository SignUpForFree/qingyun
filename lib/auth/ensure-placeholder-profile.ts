import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";

/**
 * 幂等地保证 user + 默认 profile 占位都存在。
 *
 * 使用方：
 *   - /api/dev-login（开发捷径）
 *   - /api/auth/phone/verify（浏览器手机号登录首次）
 *   - /api/auth/wechat/callback（微信 OAuth 首次，自身 transaction，不走这个 helper）
 *
 * Onboarding step3 的 PUT /api/me/profiles/[id] 依赖默认档案存在；
 * 任何登录入口都必须保证这条占位档先建好。
 */
export function ensureUserWithPlaceholderProfile(userId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(users)
      .values({ id: userId, created_at: now, updated_at: now })
      .onConflictDoNothing()
      .run();
    const existing = tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1)
      .all();
    if (existing.length === 0) {
      tx.insert(profiles)
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          is_default: true,
          nickname: "我",
          gender: "other",
          birth_date: "1990-01-01",
          birth_time: "12:00",
          birth_calendar: "solar",
          birth_place: "未填",
          created_at: now,
          updated_at: now,
        })
        .run();
    }
  });
}
