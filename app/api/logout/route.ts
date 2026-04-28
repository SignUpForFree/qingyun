import { NextResponse } from "next/server";
import { SESSION_COOKIE_KEY } from "@/lib/auth/session";

/**
 * /api/logout — 清 qy_uid cookie 后回首页
 *
 * GET 走浏览器友好的 302 重定向（直接在地址栏粘贴就能切账号），
 * POST 留给前端按钮用，返回 JSON。两条路径都把 cookie 设成 expired
 * 让浏览器丢弃，middleware 下次见到没 cookie 即跳 /login。
 *
 * 不要求登录态：未登录调用也是 ok（幂等清 cookie）。
 */
export const runtime = "nodejs";

function clearCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_KEY, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rawNext = url.searchParams.get("next") ?? "/login";
  // 仅放行同源相对路径（防开放重定向，与 dev-login 一致）
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/login";
  const res = new NextResponse(null, {
    status: 302,
    headers: { Location: safeNext },
  });
  clearCookie(res);
  return res;
}

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  clearCookie(res);
  return res;
}
