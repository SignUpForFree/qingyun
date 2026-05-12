/**
 * 邮件抽象层（与 SmsProvider 同思路）
 *
 * 默认 dev 走 ConsoleEmailProvider（只打日志），生产可切：
 *   - SmtpEmailProvider（nodemailer，自己控制账号/网关）
 *   - SesEmailProvider / 其他云服务（按需新增实现）
 *
 * 切法：通过 env EMAIL_PROVIDER=console|smtp 二选一 + 各自的 EMAIL_* env。
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  /** 可选 html；未提供时会用 text 兜底 */
  html?: string;
  replyTo?: string;
  /** 默认走 EMAIL_FROM env */
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  reason?: string;
  raw?: unknown;
}

export interface EmailProvider {
  readonly name: string;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
