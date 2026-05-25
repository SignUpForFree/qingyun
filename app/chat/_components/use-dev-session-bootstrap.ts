"use client";

import * as React from "react";

/**
 * 本地 dev：进入 /chat 时自动 POST /api/dev-login 写入 qy_uid，
 * 避免 Server Component 里 cookies().set 报错导致 API 全 401。
 *
 * 只有 dev-login 成功才返回 ready=true，防止「会话未写入 cookie 就 auto-send」→ /api/chat 401。
 */
export function useDevSessionBootstrap(enabled: boolean): boolean {
  const [ready, setReady] = React.useState(!enabled);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/dev-login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!cancelled) {
          if (res.ok) {
            setReady(true);
          } else if (process.env.NODE_ENV !== "production") {
            console.warn("[dev] dev-login failed", res.status);
            setReady(false);
          }
        }
      } catch (e) {
        if (!cancelled && process.env.NODE_ENV !== "production") {
          console.warn("[dev] dev-login error", e);
          setReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return ready;
}
