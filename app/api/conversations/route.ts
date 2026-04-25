import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/conversations — 当前用户的会话列表（HistoryDrawer 用）
 *
 * 返回最近 50 条，按 last_message_at 倒序。RLS 已限制为当前 user_id。
 */
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ conversations: [] });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, last_message_at, created_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    console.error("conversations select 失败", error);
    return NextResponse.json({ conversations: [] }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}
