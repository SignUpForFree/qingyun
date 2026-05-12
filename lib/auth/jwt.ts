import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * lib/auth/jwt — HS256 JWT sign / verify
 *
 * 用途：
 *   - 小程序登录后端发 JWT 给前端，wx.request 带 Authorization: Bearer xxx
 *   - 不依赖第三方包，避免 5MB+ jose / jsonwebtoken 进 standalone bundle
 *
 * 安全：
 *   - secret 默认走 env SESSION_SECRET（同会话 cookie 加密的同一根密钥；
 *     生产应至少 64 字节随机：openssl rand -base64 64）
 *   - alg 固定 HS256；不接受 alg=none / RS256 等异常输入（防 alg confusion）
 *
 * 失败：sign / verify 抛 JwtError，调用方自行决定 401 或刷新链路。
 */

const ALG = "HS256";

export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtError";
  }
}

export interface JwtPayload {
  sub: string;
  /** 过期 epoch 秒 */
  exp?: number;
  /** 签发时间 epoch 秒 */
  iat?: number;
  /** 自定义业务字段（uid 之外） */
  [k: string]: unknown;
}

function getSecret(): Buffer {
  const s = process.env.SESSION_SECRET ?? "";
  if (!s) throw new JwtError("SESSION_SECRET missing");
  return Buffer.from(s);
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return Buffer.from(s, "base64");
}

export interface SignJwtOptions {
  /** 过期秒数（相对当前时间） */
  expiresInSec?: number;
}

export function signJwt(
  payload: JwtPayload,
  options: SignJwtOptions = {},
): string {
  const header = { alg: ALG, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const finalPayload: JwtPayload = {
    iat: now,
    ...(options.expiresInSec
      ? { exp: now + options.expiresInSec }
      : payload.exp
        ? {}
        : { exp: now + 30 * 24 * 60 * 60 }), // 默认 30 天
    ...payload,
  };
  if (!finalPayload.exp && options.expiresInSec) {
    finalPayload.exp = now + options.expiresInSec;
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(finalPayload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sig = createHmac("sha256", getSecret()).update(signingInput).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${signingInput}.${sigB64}`;
}

export function verifyJwt<T extends JwtPayload = JwtPayload>(token: string): T {
  if (typeof token !== "string" || token.length === 0) {
    throw new JwtError("empty token");
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("malformed token");
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  } catch {
    throw new JwtError("invalid header");
  }
  if (header.alg !== ALG) {
    // 拒绝 alg=none / RS256 等，避免 alg confusion attack
    throw new JwtError(`unsupported alg: ${String(header.alg)}`);
  }

  const expected = createHmac("sha256", getSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actual = base64UrlDecode(sigB64);
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    throw new JwtError("bad signature");
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    throw new JwtError("invalid payload");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new JwtError("missing sub");
  }
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new JwtError("expired");
  }
  return payload as T;
}

/**
 * 从 Authorization header 提取 Bearer token。
 * 缺失 / 不合法格式时返回 null（调用方决定 401）。
 */
export function extractBearer(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
