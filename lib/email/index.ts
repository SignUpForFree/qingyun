import { ConsoleEmailProvider } from "./console";
import { SmtpEmailProvider } from "./smtp";
import type { EmailProvider } from "./provider";

export type { EmailProvider, SendEmailParams, SendEmailResult } from "./provider";
export { ConsoleEmailProvider } from "./console";
export { SmtpEmailProvider } from "./smtp";

export interface CreateEmailProviderOptions {
  /** 强制类型，调试用 */
  type?: "console" | "smtp";
}

export function createEmailProvider(
  opts: CreateEmailProviderOptions = {},
): EmailProvider {
  const explicit = opts.type ?? process.env.EMAIL_PROVIDER;
  switch (explicit) {
    case "smtp":
      return new SmtpEmailProvider();
    case "console":
      return new ConsoleEmailProvider();
    default:
      // 缺省：prod 也用 console（直到 SMTP 接好），避免静默失败
      return new ConsoleEmailProvider();
  }
}

declare global {
  var __qingyun_email__: EmailProvider | undefined;
}

export const email: EmailProvider =
  globalThis.__qingyun_email__ ?? createEmailProvider();
if (!globalThis.__qingyun_email__) {
  globalThis.__qingyun_email__ = email;
}
