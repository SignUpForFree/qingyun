import type { EmailProvider, SendEmailParams, SendEmailResult } from "./provider";

/**
 * 开发 / 测试用：只打日志，不真的发邮件
 *
 * 用 `EMAIL_PROVIDER=console`（dev 默认）即用此实现。
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    console.info(
      "[email][console]",
      JSON.stringify({
        to: params.to,
        from: params.from,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text.slice(0, 240),
      }),
    );
    return { ok: true };
  }
}
