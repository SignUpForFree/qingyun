"use client";

import { useSearchParams } from "next/navigation";
import { PhoneLoginForm } from "./PhoneLoginForm";

/**
 * LoginRedirectGate — 把 ?next=/foo 安全地传给 PhoneLoginForm。
 *
 * - 单独抽客户端组件 + Suspense，避免整页变成 client-only
 * - 仅放行 site-internal 同源相对路径（与 /api/dev-login 一致防开放重定向）
 */
export function LoginRedirectGate() {
  const sp = useSearchParams();
  const raw = sp.get("next") ?? "/";
  const safe = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <PhoneLoginForm redirectTo={safe} />;
}
