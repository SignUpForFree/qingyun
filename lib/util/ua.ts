/**
 * UA 判别（最小集）
 *
 * 用于 middleware 在未登录时分流：
 *   - 微信内置浏览器（UA 含 "MicroMessenger"）→ /api/auth/wechat OAuth
 *   - 普通浏览器 → /login 走手机号 OTP
 *
 * 仅根据 UA 字符串简单判断；伪造 UA 进微信 OAuth 也走不通（OAuth 服务端会拒非授权域）。
 */
export function isWechatUA(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /MicroMessenger/i.test(userAgent);
}
