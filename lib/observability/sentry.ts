/**
 * Sentry 占位（M0.7）
 *
 * M0-M4 阶段不引 @sentry/nextjs 实际依赖；仅在 SENTRY_DSN 存在时打 console.info。
 * M5.16 替换为 Sentry.init / Sentry.captureException。
 *
 * 用法：
 *   instrumentation.ts → register() 调 initSentry()
 *   全局 try/catch → reportError(err, ctx)
 */

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // M5 接 @sentry/nextjs；M0 阶段仅占位避免依赖
  // eslint-disable-next-line no-console
  console.info("[sentry] DSN configured, init deferred to M5");
}

export function reportError(err: unknown, ctx?: Record<string, unknown>): void {
  if (process.env.SENTRY_DSN) {
    // M5.16 替换：Sentry.captureException(err, { extra: ctx });
    // eslint-disable-next-line no-console
    console.error("[error captured]", err, ctx);
  } else {
    // eslint-disable-next-line no-console
    console.error("[error]", err, ctx);
  }
}

/** 测试用 */
export function resetSentry(): void {
  initialized = false;
}
