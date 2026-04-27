/**
 * Next.js instrumentation（M0.4 + M0.7）
 *
 * 在 Node runtime 启动时跑一次：
 *   1. initSentry()   — M0 stub，M5.16 接 @sentry/nextjs
 *   2. startCron()    — M0 stub registry，M5.1 接 node-cron
 *
 * Edge runtime 跳过（cron + Sentry 都需要 node 内置模块）。
 *
 * Next 16 自动检测此文件位置（项目根 / instrumentation.ts）。
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // M0.7 Sentry stub
  const { initSentry } = await import("@/lib/observability/sentry");
  initSentry();

  // M0.4 cron registry stub
  const { startCron } = await import("@/lib/cron");
  startCron();
}
