/**
 * 手机号 OTP（V1，进程内 Map）—— M1 阶段不接 SMS gateway，code 仅 console.info。
 *
 * 限制：
 *   - rate limit: 同 phone 1 次/60s
 *   - code: 6 位数字
 *   - 有效期: 10 分钟
 *   - 错误尝试: 3 次后锁定（删除条目）
 *
 * 进程内 Map 的局限：
 *   - 多进程部署会丢失（M1 单容器够用，M5 多副本前要换 SQLite/Redis）
 *   - 进程重启会丢失（用户需重发，可接受）
 *
 * 不导出 Map，只导出 send/verify/__resetForTests。
 *
 * 生产替换：M5 接入 SMS gateway 时，把 sendOtp 内部的 console.info 替换成
 * 真实下发逻辑（同 phone 一次/60s rate limit 仍由本模块兜底）。
 */

interface OtpEntry {
  code: string;
  createdAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();
const RATE_LIMIT_MS = 60_000;
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;

export interface SendOtpResult {
  sent: boolean;
  cooldownMs?: number;
}

export function sendOtp(phone: string): SendOtpResult {
  const existing = store.get(phone);
  if (existing && Date.now() - existing.createdAt < RATE_LIMIT_MS) {
    return {
      sent: false,
      cooldownMs: RATE_LIMIT_MS - (Date.now() - existing.createdAt),
    };
  }
  // 6 位数字（100000–999999），Math.random 不是密码学安全，但 OTP 短窗 + 3 次锁定 + rate limit
  // 已足够防爆破（M1 验收口径）。M5 接 SMS gateway 时同步换 crypto.randomInt。
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(phone, { code, createdAt: Date.now(), attempts: 0 });
  // M1: console only. M5: replace with SMS gateway send.
  console.info(`[otp] ${phone} ${code}`);
  return { sent: true };
}

export interface VerifyOtpResult {
  ok: boolean;
  reason?: "expired" | "wrong" | "too_many_attempts";
}

export function verifyOtp(phone: string, code: string): VerifyOtpResult {
  const entry = store.get(phone);
  if (!entry) return { ok: false, reason: "expired" };
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(phone);
    return { ok: false, reason: "expired" };
  }
  // bump attempts FIRST so wrong-then-success doesn't bypass the cap
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(phone);
    return { ok: false, reason: "too_many_attempts" };
  }
  if (entry.code !== code) return { ok: false, reason: "wrong" };
  store.delete(phone);
  return { ok: true };
}

/**
 * 仅供测试调用，清空 process-local store。
 * 生产代码不应导入此函数。
 */
export function __resetForTests(): void {
  store.clear();
}
