import type { EmailProvider, SendEmailParams, SendEmailResult } from "./provider";

/**
 * SMTP 邮件实现（nodemailer 包装，按需启用）
 *
 * 启用方式：
 *   1. 安装：pnpm add nodemailer && pnpm add -D @types/nodemailer
 *   2. .env.prod：
 *      EMAIL_PROVIDER=smtp
 *      EMAIL_FROM="轻运 AI <feedback@qingyun-ai.com>"
 *      SMTP_HOST=smtp.example.com
 *      SMTP_PORT=465
 *      SMTP_SECURE=1
 *      SMTP_USER=...
 *      SMTP_PASS=...
 *
 * 当前实现用动态 import 避免 dev 不装 nodemailer 时影响 typecheck/build。
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      return { ok: false, reason: "smtp_not_configured" };
    }

    // 用动态字符串避免 TS 解析模块；只有真正在生产装了 nodemailer 才走通
    let createTransport: (opts: Record<string, unknown>) => {
      sendMail: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    try {
      const moduleName = "nodemailer";
      const mod = (await import(/* webpackIgnore: true */ moduleName).catch(
        () => null,
      )) as { createTransport?: typeof createTransport } | null;
      if (!mod || typeof mod.createTransport !== "function") {
        return { ok: false, reason: "nodemailer_not_installed" };
      }
      createTransport = mod.createTransport;
    } catch {
      return { ok: false, reason: "nodemailer_load_failed" };
    }

    const transporter = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure:
        process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });

    try {
      const info = await transporter.sendMail({
        from: params.from ?? process.env.EMAIL_FROM ?? user,
        to: params.to,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { ok: true, raw: info };
    } catch (e) {
      return { ok: false, reason: "send_failed", raw: e };
    }
  }
}
