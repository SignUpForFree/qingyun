/**
 * 浏览器侧 instrumentation（Next.js 16）
 *
 * Sentry client init：仅当 NEXT_PUBLIC_SENTRY_DSN 存在时加载。
 * 动态 import 让不开 Sentry 的环境（dev / 内部测试）连 SDK 都不进 bundle。
 *
 * 注意区分：
 *   - SENTRY_DSN              ：服务端用（lib/observability/sentry.ts）
 *   - NEXT_PUBLIC_SENTRY_DSN  ：客户端用（本文件）
 *   两者通常是同一个 project DSN，只是 env 命名要带 NEXT_PUBLIC_ 前缀才能在浏览器读到
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0,
      ),
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE ?? 0,
      ),
      // 不要采集 cookie / authorization
      beforeSend(event) {
        if (event.request?.cookies) delete event.request.cookies;
        return event;
      },
    });
  }).catch((e) => {
    console.warn("[sentry-client] init failed", e);
  });
}
