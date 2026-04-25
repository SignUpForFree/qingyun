import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * 管理员 client（service_role key, **绕过 RLS**）
 *
 * 仅用于服务端可信路径：
 *   - /api/profile 创建档案后写 bazi_charts
 *   - /api/chat 用户级限流的全表 count 查询
 *   - cron / migration / seed
 *
 * **警告**：service_role key 可读写所有用户数据，禁止暴露到客户端。
 */
export function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未配置 — admin client 需要 service_role key",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
