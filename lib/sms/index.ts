/**
 * SmsProvider 工厂 + 全局单例
 *
 * env：
 *   SMS_PROVIDER=mock | tencent     默认：dev=mock, prod=tencent（强制）
 *
 * 用法：
 *   import { sms } from "@/lib/sms";
 *   await sms.send({ phone, params: [code, "5"], templateId, signName });
 */
import { MockSmsProvider } from "./mock";
import { TencentSmsProvider } from "./tencent";
import type { SmsProvider } from "./provider";

export type { SmsProvider, SendSmsParams, SendSmsResult } from "./provider";
export { MockSmsProvider } from "./mock";
export { TencentSmsProvider } from "./tencent";

export interface CreateSmsProviderOptions {
  kind?: "mock" | "tencent";
}

export function createSmsProvider(options: CreateSmsProviderOptions = {}): SmsProvider {
  const explicit = options.kind;
  const fromEnv = (process.env.SMS_PROVIDER as "mock" | "tencent" | undefined) ?? undefined;
  // Prod 默认 tencent，避免误把 mock 带到生产把 OTP 写进 log
  const fallback = process.env.NODE_ENV === "production" ? "tencent" : "mock";
  const kind = explicit ?? fromEnv ?? fallback;
  switch (kind) {
    case "mock":
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[sms] MockSmsProvider used in production — OTP will not be delivered. Set SMS_PROVIDER=tencent",
        );
      }
      return new MockSmsProvider();
    case "tencent":
      return new TencentSmsProvider();
    default:
      throw new Error(`[sms] Unknown SMS_PROVIDER: ${String(kind)}`);
  }
}

declare global {
  // 防 dev HMR 多实例
  var __qingyun_sms__: SmsProvider | undefined;
}

export const sms: SmsProvider = globalThis.__qingyun_sms__ ?? createSmsProvider();
if (!globalThis.__qingyun_sms__) {
  globalThis.__qingyun_sms__ = sms;
}
