import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";

export type SubscriptionPlan = "free" | "premium";

export interface UserSubscription {
  plan: SubscriptionPlan;
  expiresAt: string | null;
}

/**
 * 查询用户会员状态
 */
export async function getSubscription(userId: string): Promise<UserSubscription> {
  const db = getDb();
  const rows = await db
    .select({
      plan: subscriptions.plan,
      expires_at: subscriptions.expires_at,
    })
    .from(subscriptions)
    .where(eq(subscriptions.user_id, userId))
    .limit(1);

  if (rows.length === 0) {
    return { plan: "free", expiresAt: null };
  }

  const row = rows[0];
  // 检查是否过期
  if (row.plan === "premium" && row.expires_at) {
    const expiresAt = new Date(row.expires_at);
    if (expiresAt < new Date()) {
      return { plan: "free", expiresAt: row.expires_at };
    }
  }

  return {
    plan: row.plan as SubscriptionPlan,
    expiresAt: row.expires_at,
  };
}

/**
 * 判断用户是否为 premium 会员
 */
export async function isPremium(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  return sub.plan === "premium";
}
