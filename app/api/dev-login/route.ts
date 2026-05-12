import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_KEY, setSessionCookie } from "@/lib/auth/session";
import { ensureUserWithPlaceholderProfile } from "@/lib/auth/ensure-placeholder-profile";

// better-sqlite3 需要 nodejs runtime；显式声明避免 edge runtime 的兜底失败
export const runtime = "nodejs";

/**
 * 开发模式登录捷径（dev 默认开；prod 仅在 BETA_DEV_LOGIN=1 时开放）
 *
 * 用途：
 *   - 本地 dev 跑 /api/chat 等鉴权接口（middleware 要求 qy_uid cookie）
 *   - e2e 测试（参 e2e/{bazi,meihua,history-search}-flow.spec.ts）
 *   - 内测期 SMS 审核未完成时，靠这条路径直接拿 uid 走全链路
 *
 * 行为（uid 复用优先级，从高到低）：
 *   1. body.userId（显式指定，e2e 测试用）
 *   2. cookie qy_uid（db reset 后复用同一个 uid，db 自愈不丢历史）
 *   3. crypto.randomUUID()（首次登录）
 *
 *   然后幂等地建 user + 占位 profile（避免 onboarding 之前外键报错），
 *   写 qy_uid cookie（与 setSessionCookie 一致，httpOnly + sameSite=lax）。
 *
 * 生产环境默认 404；只有 BETA_DEV_LOGIN=1 时开放，避免被滥用绕过登录。
 * 真实上线（SMS / 微信都接好后）务必把 BETA_DEV_LOGIN 移除。
 */
export async function POST(req: Request): Promise<NextResponse> {
  const allowedInProd = process.env.BETA_DEV_LOGIN === "1";
  if (process.env.NODE_ENV === "production" && !allowedInProd) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: { userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* 空 body 也允许 */
  }

  const cookieStore = await cookies();
  const existingUid = cookieStore.get(SESSION_COOKIE_KEY)?.value;
  const userId = body.userId ?? existingUid ?? crypto.randomUUID();

  try {
    ensureUserWithPlaceholderProfile(userId);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "ensureUser 失败" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ userId });
  setSessionCookie(res, userId);
  return res;
}
