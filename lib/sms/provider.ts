/**
 * SmsProvider — 短信发送抽象
 *
 * v1：mock（开发本地 console.info）/ tencent（腾讯云 SMS Sender V20210111）双实现，
 * 通过 env SMS_PROVIDER 切换。线上必走 tencent；MOCK 仅 dev/test。
 *
 * 详见 docs/superpowers/specs/2026-05-06-launch-readiness.md。
 */

export interface SendSmsParams {
  /** E.164 格式或 11 位国内手机号；provider 内部按需补 +86 */
  phone: string;
  /**
   * 模板变量；腾讯云模板里 {1}{2}{3} 顺序对应 params[0..2]
   * mock provider 仅做 console.info
   */
  params: string[];
  /** 模板 ID（腾讯云控制台「短信正文」绑定）；mock 不用 */
  templateId?: string;
  /** 签名（腾讯云审核通过的"【xxx】"签名内容，不带方括号）；mock 不用 */
  signName?: string;
}

export interface SendSmsResult {
  ok: boolean;
  /** 失败原因（rate-limit / phone-format / provider-error / config-missing 等） */
  reason?: string;
  /** 透出 provider 原始返回（debug 用） */
  raw?: unknown;
}

export interface SmsProvider {
  readonly name: string;
  send(params: SendSmsParams): Promise<SendSmsResult>;
}
