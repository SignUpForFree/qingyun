import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * 浏览器端 Supabase client（基于 cookies session）
 *
 * 仅在 Client Component / hooks 内使用。
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置 — 请填到 .env.local",
    );
  }
  return createBrowserClient<Database>(url, anonKey);
}
