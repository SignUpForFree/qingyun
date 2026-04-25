import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * 全局中间件
 *
 * 1. 续期 Supabase session cookie（每个请求都会校验 + 必要时刷新 access token）
 * 2. 首次访问 / 无 session 时，自动走匿名登录（spec 0-friction onboarding）
 *
 * 从 matcher 排除：静态资源 / api/healthz / favicon
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // .env.local 还没填时，直接放行不阻塞 W1 期间的 dev 体验
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  // 触发 session 续期；getUser 比 getSession 更安全（向上游验证 token）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 无 session → 自动匿名登录
  if (!user) {
    await supabase.auth.signInAnonymously();
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 排除：
     *   _next/static / _next/image / favicon / images / api/healthz
     */
    "/((?!_next/static|_next/image|favicon.ico|api/healthz|images|.*\\.(?:svg|png|jpg|jpeg|webp)).*)",
  ],
};
