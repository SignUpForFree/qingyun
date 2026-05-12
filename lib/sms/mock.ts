/**
 * MockSmsProvider — dev / test 用，console 打印验证码
 *
 * 不做任何外网调用。生产环境不要使用（启动时 createSmsProvider 会 warn）。
 *
 * 日志策略：
 *   - dev / test  → 一直打 console.info（验证码 + 模板）
 *   - prod 默认   → 静默，避免误用时把验证码持续刷进日志
 *   - prod + env `SMS_MOCK_LOG=1` → 强制打（内测期短信通道未通时用这个看码）
 */
import type { SendSmsParams, SendSmsResult, SmsProvider } from "./provider";

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const allowProdLog = process.env.SMS_MOCK_LOG === "1";
    const shouldLog =
      process.env.NODE_ENV !== "production" || allowProdLog;
    if (shouldLog) {
      const tag = process.env.NODE_ENV === "production" ? "sms:mock:beta" : "sms:mock";
      console.info(
        `[${tag}] phone=${params.phone} template=${params.templateId ?? "-"} params=${JSON.stringify(params.params)}`,
      );
    }
    return { ok: true, raw: { provider: "mock" } };
  }
}
