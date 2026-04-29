"use client";

import { openLoginModal } from "@/lib/auth/login-bus";

/**
 * apiFetch — 包装 fetch，401 自动弹登录窗
 *
 * 用法和 fetch 一致；遇到 401 时 dispatch login-open 事件，由 LoginSheet 监听弹窗。
 * 401 仍照常返回，让调用方决定是 retry 还是 toast。
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    openLoginModal();
  }
  return res;
}
