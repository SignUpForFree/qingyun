/**
 * 手机号 OTP — KVStore 版（v2，2026-05-06）
 *
 * 变更：
 *   - 内部 Map → KVStore（默认进程内 Map，env KV_STORE=redis 切 Redis）
 *   - sendOtp 改为通过 SmsProvider 真实下发；mock provider 在 dev 仅 console.info
 *   - prod 强制禁用 MOCK_OTP_BYPASS（绕过开关只在 dev/test 生效）
 *
 * 仍保留：
 *   - 同 phone 1 次 / 60s rate-limit（KV ttl 60s 实现）
 *   - 6 位数字 code，10 分钟 TTL
 *   - 错码 3 次锁定（删 key）
 */
import { kv } from "@/lib/cache";
import { sms } from "@/lib/sms";

const RATE_LIMIT_SEC = 60;
const TTL_SEC = 10 * 60;
const MAX_ATTEMPTS = 3;

const OTP_TEMPLATE_ID = process.env.TENCENT_SMS_TEMPLATE_ID_OTP ?? "";
const OTP_SIGN_NAME = process.env.TENCENT_SMS_SIGN_NAME ?? "";
/** 模板里 {2} 通常是分钟数，跟 TTL_SEC 保持一致 */
const OTP_TTL_MINUTES = String(Math.floor(TTL_SEC / 60));

interface OtpEntry {
  code: string;
  createdAt: number;
  attempts: number;
}

function otpKey(phone: string): string {
  return `qy:otp:${phone}`;
}
function rateKey(phone: string): string {
  return `qy:otp-rate:${phone}`;
}

export interface SendOtpResult {
  sent: boolean;
  cooldownMs?: number;
  /** 失败原因（不下发场景）；UI 可选展示 */
  reason?: string;
}

/**
 * 当前所有环境（dev / test / prod）OTP 一律固定为 "666666"，方便：
 *   1. 内测期短信通道（腾讯云）尚未审核通过 → 用户输 666666 直接登录
 *   2. 测试用例可预期固定值（不影响 lastSmsParams 取 code 再 verify 的断言）
 *   3. 与 mock provider 配合，无短信通道也能跑全链路
 *
 * 安全权衡：因为 verify 仍走"KV 内存储 code → strict equal 比对"路径，
 * 即使有人猜对 666666，也仍然被 rate-limit (60s) + 锁定 (3 错) 兜底；
 * 不是"任意 6 位都通过"（那是 MOCK_OTP_BYPASS 模式，prod 强制禁用）。
 *
 * ⚠️ 接通真实腾讯云短信前必须改回 crypto.randomInt(100000, 1_000_000) —
 *    否则真实短信里也会发 666666，等同于公开后门。
 *    grep 关键字：FIXED_OTP_CODE
 */
const FIXED_OTP_CODE = "666666";

/** dev/test 下 OTP 是否为固定码（当前始终为 true，接通真实 SMS 后改为 false） */
export function isFixedOtp(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

/** 获取固定验证码（仅供 send-otp route 回传给前端 toast 用，prod 永远不暴露） */
export function getFixedOtpCode(): string | undefined {
  if (!isFixedOtp()) return undefined;
  return FIXED_OTP_CODE;
}

function genCode(): string {
  return FIXED_OTP_CODE;
}

export async function sendOtp(phone: string): Promise<SendOtpResult> {
  const cooldown = await kv.ttl(rateKey(phone));
  if (cooldown > 0) {
    return { sent: false, cooldownMs: cooldown * 1000 };
  }

  const code = genCode();
  const entry: OtpEntry = { code, createdAt: Date.now(), attempts: 0 };
  await kv.set(otpKey(phone), entry, { ttlSeconds: TTL_SEC });
  await kv.set(rateKey(phone), 1, { ttlSeconds: RATE_LIMIT_SEC });

  // 走 SmsProvider 抽象下发（mock：console.info；tencent：真发）
  const result = await sms.send({
    phone,
    params: [code, OTP_TTL_MINUTES],
    templateId: OTP_TEMPLATE_ID || undefined,
    signName: OTP_SIGN_NAME || undefined,
  });
  if (!result.ok) {
    // 下发失败：保留 rate-limit（防刷），但记录 reason 让 UI 解释
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[otp] send failed for ${phone}: ${result.reason}`);
    } else {
      console.error(`[otp] send failed: ${result.reason}`);
    }
    return { sent: false, reason: result.reason ?? "sms-error" };
  }

  return { sent: true };
}

export interface VerifyOtpResult {
  ok: boolean;
  reason?: "expired" | "wrong" | "too_many_attempts";
}

/**
 * MOCK_OTP_BYPASS 仅 dev/test 生效。
 * 生产即使 env 设了 1 也直接走真实校验，避免误开关绕过登录。
 */
export function isMockOtpBypass(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.MOCK_OTP_BYPASS === "1";
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<VerifyOtpResult> {
  if (isMockOtpBypass() && /^\d{6}$/.test(code)) {
    return { ok: true };
  }
  const entry = await kv.get<OtpEntry>(otpKey(phone));
  if (!entry) return { ok: false, reason: "expired" };
  if (Date.now() - entry.createdAt > TTL_SEC * 1000) {
    await kv.del(otpKey(phone));
    return { ok: false, reason: "expired" };
  }
  // attempts 先 +1，避免 wrong→success 序列绕过 cap
  const next: OtpEntry = { ...entry, attempts: entry.attempts + 1 };
  if (next.attempts > MAX_ATTEMPTS) {
    await kv.del(otpKey(phone));
    return { ok: false, reason: "too_many_attempts" };
  }
  if (next.code !== code) {
    // 持久化 attempts 增量；KV.set 不带 ifAbsent → 重新 set 整 entry，TTL 继续
    const remaining = await kv.ttl(otpKey(phone));
    await kv.set(otpKey(phone), next, {
      ttlSeconds: remaining > 0 ? remaining : TTL_SEC,
    });
    return { ok: false, reason: "wrong" };
  }
  await kv.del(otpKey(phone));
  return { ok: true };
}

/**
 * 仅供测试调用，清空进程 KV（仅 InProcessKVStore 生效；Redis 不会真清）。
 */
export function __resetForTests(): void {
  type WithReset = { reset?: () => void };
  (kv as unknown as WithReset).reset?.();
}
