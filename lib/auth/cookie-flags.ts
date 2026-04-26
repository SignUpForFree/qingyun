/**
 * Cookie secure flag 决策（spec §6.5 微信浏览器 / http 部署兼容）
 *
 * 优先级：
 *   1. COOKIE_SECURE=false  显式关闭（用于 http 直连部署，如腾讯云 IP:3000）
 *   2. COOKIE_SECURE=true   显式开启
 *   3. fallback 看 NODE_ENV=production
 *
 * 加 caddy/nginx 反代上 https 后把这个 env 删掉即可恢复默认 secure
 */
export function shouldSecureCookie(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}
