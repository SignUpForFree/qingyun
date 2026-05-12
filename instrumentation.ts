/**
 * Next.js instrumentation（2026-05-07 接入实际依赖）
 *
 * 在 Node runtime 启动时跑一次：
 *   1. initSentry() — @sentry/nextjs（SENTRY_DSN 缺省即 no-op）
 *   2. registerJob × N — 内置 cron 任务清单
 *   3. startCron() — node-cron 调度（CRON_ENABLED=1 才真启）
 *
 * Edge runtime 跳过（cron + Sentry SDK 均依赖 node 内置模块）。
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initSentry } = await import("@/lib/observability/sentry");
  initSentry();

  const { registerJob, startCron } = await import("@/lib/cron");

  // 任务清单（动态 import 避免 edge runtime 分析时拉 better-sqlite3）
  const { dailyFortunePushTask } = await import(
    "@/lib/cron/jobs/daily-fortune-push"
  );
  const { dailySummaryTask } = await import("@/lib/cron/jobs/daily-summary");

  // 防 HMR 重复注册（dev 重载会再走 register）
  try {
    registerJob({
      name: "daily-fortune-push",
      expr: "30 7 * * *", // 07:30 每天
      task: dailyFortunePushTask,
    });
    registerJob({
      name: "daily-summary",
      expr: "15 0 * * *", // 00:15 每天
      task: dailySummaryTask,
    });
  } catch (e) {
    // already registered → 忽略
    if (process.env.NODE_ENV !== "production") {
      console.info("[instrumentation] cron register skipped:", (e as Error).message);
    }
  }

  startCron();
}
