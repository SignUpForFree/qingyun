"use client";

import { useEffect } from "react";

/**
 * Next.js 全局错误兜底（root layout 异常时渲染）
 *
 * 行为：
 *   - 上报 Sentry（NEXT_PUBLIC_SENTRY_DSN 存在时）
 *   - 渲染极简错误页（包不进 layout，避免 layout 自身报错）
 *
 * 注意：global-error 必须自带 <html>/<body>（layout 已废）
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 如果 Sentry 已经 init（instrumentation-client.ts），就上报
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error);
      });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[global-error]", error);
    }
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          color: "#222",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 600 }}>
          页面出了点小状况
        </h1>
        <p style={{ marginTop: 12, color: "#666", maxWidth: 360 }}>
          已记录此次异常。可以稍后再试，或刷新页面重新加载。
        </p>
        {error.digest ? (
          <p style={{ marginTop: 8, color: "#999", fontSize: 12 }}>
            ref: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "10px 24px",
            borderRadius: 12,
            border: 0,
            background: "#5b6cff",
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          重试
        </button>
      </body>
    </html>
  );
}
