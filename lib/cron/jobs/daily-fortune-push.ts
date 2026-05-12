import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { fortunesDaily } from "@/lib/db/schema";
import { reportError } from "@/lib/observability/sentry";

/**
 * 每日运势推送任务
 *
 * 时机：每天 07:30（Asia/Shanghai，由 cron tz 控制）
 *
 * 行为：
 *   1. 统计今日已生成 fortunes_daily 的人数
 *   2. 留 hook：等小程序模板消息 / 公众号 OA 推送上线后接进来
 *
 * 当前 M5 阶段只做"看得见的占位"：把统计 + 计划要推送的用户数打到日志，
 * 不实际下发消息。微信模板消息接入参 spec §X。
 */
export async function dailyFortunePushTask(): Promise<void> {
  const db = getDb();
  // 用本地时区当天日期；CRON_TZ=Asia/Shanghai 时和 fortunes_daily.date 自然对齐
  const today = new Date().toISOString().slice(0, 10);

  try {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(fortunesDaily)
      .where(sql`${fortunesDaily.date} = ${today}`);

    const count = Number(rows[0]?.count ?? 0);
    console.info(
      `[cron][daily-fortune-push] date=${today} ready_users=${count} (push not yet wired)`,
    );

    // TODO(M5.x): 发送模板消息
    //   1. 取所有已 push_subscribe 的 wechat_bind 用户
    //   2. 遍历调用 wx.subscribe-message API
    //   3. 限速 / 并发控制 / 失败重试
  } catch (e) {
    reportError(e, { task: "daily-fortune-push", date: today });
  }
}
