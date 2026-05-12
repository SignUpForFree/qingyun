/**
 * TencentSmsProvider — 腾讯云短信 V20210111 SendSms 接口
 *
 * 选用 fetch 直接打 TC3-HMAC-SHA256 签名，不依赖 tencentcloud-sdk-nodejs 5MB 大包。
 *
 * env：
 *   TENCENT_SMS_SECRET_ID       (TC API CAM 密钥 SecretId)
 *   TENCENT_SMS_SECRET_KEY      (CAM 密钥 SecretKey)
 *   TENCENT_SMS_REGION          默认 ap-guangzhou
 *   TENCENT_SMS_SDK_APP_ID      短信应用 SdkAppId
 *   TENCENT_SMS_SIGN_NAME       默认签名（不含【】）
 *   TENCENT_SMS_TEMPLATE_ID_OTP OTP 用模板 ID
 *
 * 文档：https://cloud.tencent.com/document/product/382/55981
 */
import { createHash, createHmac } from "node:crypto";
import type { SendSmsParams, SendSmsResult, SmsProvider } from "./provider";

const HOST = "sms.tencentcloudapi.com";
const SERVICE = "sms";
const VERSION = "2021-01-11";
const ACTION = "SendSms";

interface TencentEnv {
  secretId: string;
  secretKey: string;
  region: string;
  sdkAppId: string;
  signName: string;
  defaultTemplateId: string;
}

function readEnv(): TencentEnv {
  const secretId = process.env.TENCENT_SMS_SECRET_ID ?? "";
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY ?? "";
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID ?? "";
  const signName = process.env.TENCENT_SMS_SIGN_NAME ?? "";
  const region = process.env.TENCENT_SMS_REGION ?? "ap-guangzhou";
  const defaultTemplateId = process.env.TENCENT_SMS_TEMPLATE_ID_OTP ?? "";
  return { secretId, secretKey, region, sdkAppId, signName, defaultTemplateId };
}

function normalizePhone(phone: string): string {
  if (phone.startsWith("+")) return phone;
  if (/^1\d{10}$/.test(phone)) return `+86${phone}`;
  return phone;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function hmac256(key: Buffer | string, s: string): Buffer {
  return createHmac("sha256", key).update(s).digest();
}

function buildAuthorization(env: TencentEnv, body: string, timestamp: number): string {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${ACTION.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedRequestPayload = sha256Hex(body);
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join("\n");

  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const secretDate = hmac256(`TC3${env.secretKey}`, date);
  const secretService = hmac256(secretDate, SERVICE);
  const secretSigning = hmac256(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");

  return (
    `TC3-HMAC-SHA256 Credential=${env.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`
  );
}

export class TencentSmsProvider implements SmsProvider {
  readonly name = "tencent";

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const env = readEnv();
    if (!env.secretId || !env.secretKey || !env.sdkAppId) {
      return { ok: false, reason: "config-missing" };
    }
    const signName = params.signName ?? env.signName;
    const templateId = params.templateId ?? env.defaultTemplateId;
    if (!signName || !templateId) {
      return { ok: false, reason: "template-or-sign-missing" };
    }

    const phone = normalizePhone(params.phone);
    const bodyObj = {
      PhoneNumberSet: [phone],
      SmsSdkAppId: env.sdkAppId,
      SignName: signName,
      TemplateId: templateId,
      TemplateParamSet: params.params,
    };
    const body = JSON.stringify(bodyObj);
    const timestamp = Math.floor(Date.now() / 1000);

    const authorization = buildAuthorization(env, body, timestamp);

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      Host: HOST,
      Authorization: authorization,
      "X-TC-Action": ACTION,
      "X-TC-Version": VERSION,
      "X-TC-Region": env.region,
      "X-TC-Timestamp": String(timestamp),
    };

    try {
      const res = await fetch(`https://${HOST}/`, {
        method: "POST",
        headers,
        body,
      });
      const json = (await res.json()) as {
        Response?: {
          Error?: { Code?: string; Message?: string };
          SendStatusSet?: Array<{ Code?: string; Message?: string }>;
          RequestId?: string;
        };
      };
      const resp = json.Response;
      if (!resp) {
        return { ok: false, reason: "empty-response", raw: json };
      }
      if (resp.Error?.Code) {
        return {
          ok: false,
          reason: `tc-error:${resp.Error.Code}`,
          raw: resp,
        };
      }
      const first = resp.SendStatusSet?.[0];
      if (first?.Code !== "Ok") {
        return {
          ok: false,
          reason: `tc-send:${first?.Code ?? "unknown"}`,
          raw: resp,
        };
      }
      return { ok: true, raw: resp };
    } catch (err) {
      return {
        ok: false,
        reason: "network",
        raw: { message: (err as Error).message },
      };
    }
  }
}
