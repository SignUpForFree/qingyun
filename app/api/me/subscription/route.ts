import { ensureUserId } from "@/lib/auth/session";
import { getSubscription } from "@/lib/subscription/repository";

export const runtime = "nodejs";

/**
 * GET /api/me/subscription — 查询当前用户会员状态
 */
export async function GET() {
  const userId = await ensureUserId();
  const sub = await getSubscription(userId);
  return Response.json(sub);
}
