/**
 * 登录弹窗事件总线（client-only）
 *
 * 为什么用 event：apiFetch 在 hook 之外触发，没法直接调用 React Context；
 * 用 window CustomEvent 跨组件通信，LoginSheet 监听后弹窗。
 */

const EVENT_OPEN = "occult:login-open";

export function openLoginModal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_OPEN));
}

export function onLoginModalOpen(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT_OPEN, handler);
  return () => window.removeEventListener(EVENT_OPEN, handler);
}
