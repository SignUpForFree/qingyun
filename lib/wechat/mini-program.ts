import "server-only";

/**
 * 小程序登录支持 — code2Session 请求封装
 *
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
 *
 * 流程：
 *   1. 小程序 wx.login() 拿 jsCode
 *   2. 小程序 wx.request 发到 /api/auth/wechat-mini { code }
 *   3. 服务端用本模块 code2Session(code) 调微信换 openid + session_key + unionid
 *   4. upsert wechat_bind（按 openid，若有 unionid 用 unionid 合并 H5 老账号）
 *   5. 签 JWT 返回
 *
 * env：
 *   WECHAT_MINI_APPID         小程序 AppID（与公众号 AppID 不同）
 *   WECHAT_MINI_APPSECRET     小程序 AppSecret
 *
 * 错误码：
 *   - errcode 0          成功
 *   - errcode 40029      code 无效（已使用 / 过期）
 *   - errcode 45011      api 调用频率限制
 *   - errcode -1         系统繁忙
 */

const C2S_URL = "https://api.weixin.qq.com/sns/jscode2session";

export interface MiniCode2SessionResp {
  /** 用户唯一标识（小程序级） */
  openid: string;
  /** 会话密钥 — 解密 wx.getUserInfo 返的 encryptedData 时用；JWT 路径不用 */
  session_key: string;
  /** 用户在开放平台下的统一标识（仅当公众号 / 小程序绑定到同一开放平台时返回） */
  unionid?: string;
}

export class WechatMiniLoginError extends Error {
  readonly errcode: number;
  readonly raw: unknown;
  constructor(message: string, errcode: number, raw: unknown) {
    super(message);
    this.errcode = errcode;
    this.raw = raw;
    this.name = "WechatMiniLoginError";
  }
}

interface MiniLoginConfig {
  appid: string;
  secret: string;
}

function readConfig(): MiniLoginConfig {
  const appid = process.env.WECHAT_MINI_APPID ?? "";
  const secret = process.env.WECHAT_MINI_APPSECRET ?? "";
  return { appid, secret };
}

export interface Code2SessionDeps {
  /** 注入 fetch（测试 mock） */
  fetchImpl?: typeof fetch;
}

export async function code2Session(
  code: string,
  deps: Code2SessionDeps = {},
): Promise<MiniCode2SessionResp> {
  const { appid, secret } = readConfig();
  if (!appid || !secret) {
    throw new WechatMiniLoginError("WECHAT_MINI_APPID/APPSECRET missing", -100, null);
  }
  if (!code) {
    throw new WechatMiniLoginError("empty code", 40029, null);
  }
  const url = new URL(C2S_URL);
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const f = deps.fetchImpl ?? fetch;
  const res = await f(url.toString(), { method: "GET" });
  const json = (await res.json()) as Partial<MiniCode2SessionResp> & {
    errcode?: number;
    errmsg?: string;
  };

  if (json.errcode && json.errcode !== 0) {
    throw new WechatMiniLoginError(
      `code2session ${json.errcode}: ${json.errmsg ?? "unknown"}`,
      json.errcode,
      json,
    );
  }
  if (!json.openid || !json.session_key) {
    throw new WechatMiniLoginError("missing openid/session_key", -101, json);
  }
  return {
    openid: json.openid,
    session_key: json.session_key,
    unionid: json.unionid,
  };
}
