/**
 * Sentry 接入封装（2026-05-07 启用）
 *
 * 设计：
 *   - `initSentry()` 走 instrumentation.ts，在 server / edge runtime 都调一次
 *   - 通过 process.env.NEXT_RUNTIME 判 runtime（nodejs / edge），分别 init
 *   - SENTRY_DSN 缺省 → no-op（dev 默认不开）
 *   - reportError 是统一上报口子；调用方不需要直接 import @sentry/nextjs
 *
 * 客户端侧：app/global-error.tsx 在 React error 边界里调 Sentry.captureException
 */

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  // 动态 import：dev 没 DSN 时连模块都不加载，避免 5MB Sentry 进 bundle
  void (async () => {
    try {
      const Sentry = await import("@sentry/nextjs");
      const env = process.env.NEXT_RUNTIME ?? "nodejs";
      const release =
        process.env.SENTRY_RELEASE ??
        process.env.npm_package_version ??
        "unknown";
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? "development",
        release,
        // 流量大时收紧，内测期 100% 抓
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
        // 内测先关 session replay（流量大）
        // replaysSessionSampleRate: 0,
        // replaysOnErrorSampleRate: 0,
        // 不要把 OTP / 微信 secret 上传
        beforeSend(event) {
          if (event.request?.headers) {
            delete event.request.headers["authorization"];
            delete event.request.headers["cookie"];
          }
          return event;
        },
      });
      console.info(`[sentry] init ok (runtime=${env}, release=${release})`);
    } catch (e) {
      console.warn("[sentry] init failed", e);
    }
  })();
}

export function reportError(err: unknown, ctx?: Record<string, unknown>): void {
  if (process.env.SENTRY_DSN) {
    void (async () => {
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
      } catch {
        /* swallow */
      }
    })();
    console.error("[error captured]", err, ctx);
  } else {
    console.error("[error]", err, ctx);
  }
}

/** 测试用 */
export function resetSentry(): void {
  initialized = false;
}
