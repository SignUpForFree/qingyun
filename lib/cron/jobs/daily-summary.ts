import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { messages, users } from "@/lib/db/schema";
import { reportError } from "@/lib/observability/sentry";

/**
 * 昨日活跃 / 调用统计 — 给运营看"昨天 N 个新用户、M 次 chat、X 次八字"
 *
 * 时机：每天 00:15（Asia/Shanghai）
 *
 * 输出：仅 console（M5 阶段），等观测侧上线后接 metric / DataDog
 */
export async function dailySummaryTask(): Promise<void> {
  const db = getDb();
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const [msgRow] = await db
      .select({
        total: sql<number>`count(*)`,
        chat: sql<number>`sum(case when ${messages.intent} = 'chat' then 1 else 0 end)`,
        bazi: sql<number>`sum(case when ${messages.intent} = 'bazi' then 1 else 0 end)`,
        meihua: sql<number>`sum(case when ${messages.intent} = 'meihua' then 1 else 0 end)`,
        dream: sql<number>`sum(case when ${messages.intent} = 'dream' then 1 else 0 end)`,
        divination: sql<number>`sum(case when ${messages.intent} = 'divination' then 1 else 0 end)`,
      })
      .from(messages)
      .where(sql`date(${messages.created_at}) = ${yesterday}`);

    const [userRow] = await db
      .select({ newUsers: sql<number>`count(*)` })
      .from(users)
      .where(sql`date(${users.created_at}) = ${yesterday}`);

    console.info(
      `[cron][daily-summary] date=${yesterday}`,
      JSON.stringify({
        new_users: userRow?.newUsers ?? 0,
        msgs: msgRow?.total ?? 0,
        chat: msgRow?.chat ?? 0,
        bazi: msgRow?.bazi ?? 0,
        meihua: msgRow?.meihua ?? 0,
        dream: msgRow?.dream ?? 0,
        divination: msgRow?.divination ?? 0,
      }),
    );
  } catch (e) {
    reportError(e, { task: "daily-summary", date: yesterday });
  }
}
