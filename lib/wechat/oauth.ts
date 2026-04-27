import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * 微信 OAuth 网页授权（snsapi_userinfo）—— state 签名 + authorize URL
 *
 * spec §3.2 流程：
 *   /api/auth/wechat → buildAuthorizeUrl → 跳微信 → callback?code=&state=
 *   → verifyState（HMAC + 5min TTL，防 CSRF + 防重放）
 *
 * state 格式：`{timestamp}.{nonce}.{hex-sha256-hmac}`
 *   - timestamp: ms epoch 文本
 *   - nonce: caller 提供的随机串（用于防重）
 *   - sig: HMAC-SHA256(WECHAT_STATE_SECRET, "{ts}.{nonce}") 的 hex
 *
 * 注意 #14：微信 OAuth 内嵌浏览器 cookie 隔离，调试必须微信开发者工具或真机。
 */

const STATE_TTL_MS = 5 * 60_000;

export function signState(nonce: string): string {
  const env = getEnv();
  const ts = Date.now();
  const payload = `${ts}.${nonce}`;
  const sig = crypto
    .createHmac("sha256", env.WECHAT_STATE_SECRET)
    .update(payload)
    .digest("hex");
  return `${ts}.${nonce}.${sig}`;
}

export interface VerifyStateResult {
  ok: boolean;
  nonce?: string;
  reason?: "malformed" | "bad_sig" | "expired";
}

export function verifyState(state: string): VerifyStateResult {
  const env = getEnv();
  const parts = state.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [ts, nonce, sig] = parts;

  // 期望 sig 是 hex 字符串
  const expected = crypto
    .createHmac("sha256", env.WECHAT_STATE_SECRET)
    .update(`${ts}.${nonce}`)
    .digest("hex");

  // 长度先检查，避免 timingSafeEqual 抛错
  if (sig.length !== expected.length) return { ok: false, reason: "bad_sig" };

  // 把双方都按 hex 解析，非法 hex 视为 bad_sig
  let sigBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "hex");
    expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || sigBuf.length === 0) {
      return { ok: false, reason: "bad_sig" };
    }
  } catch {
    return { ok: false, reason: "bad_sig" };
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return { ok: false, reason: "bad_sig" };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Date.now() - tsNum > STATE_TTL_MS || tsNum > Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, nonce };
}

export function buildAuthorizeUrl(nonce: string): string {
  const env = getEnv();
  const url = new URL("https://open.weixin.qq.com/connect/oauth2/authorize");
  url.searchParams.set("appid", env.WECHAT_APPID);
  url.searchParams.set("redirect_uri", env.WECHAT_OA_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "snsapi_userinfo");
  url.searchParams.set("state", signState(nonce));
  return url.toString() + "#wechat_redirect";
}
