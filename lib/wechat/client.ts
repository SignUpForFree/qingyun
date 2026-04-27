/**
 * 微信接口 fetch 封装：
 *   - 10s timeout（spec §3.9 #1：超时降级到旧 token / 报警）
 *   - 统一 errcode → throw（caller 用正则匹配 errcode 数字判定具体错误码）
 *   - GET / POST 通用
 *
 * Why a tiny wrapper：M1.4 OAuth、M1.5 token-store、M5 template message 都要复用。
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export interface WechatFetchOptions {
  method?: "GET" | "POST";
  body?: string;
  timeoutMs?: number;
}

interface WechatErrorResponse {
  errcode?: number;
  errmsg?: string;
}

export async function wechatFetch<T>(url: string, opts: WechatFetchOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: HeadersInit = method === "POST"
    ? { "Content-Type": "application/json" }
    : {};
  const r = await fetch(url, {
    method,
    headers,
    body: opts.body,
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`wechat http ${r.status}`);
  const j = (await r.json()) as WechatErrorResponse & T;
  if (j.errcode !== undefined && j.errcode !== 0) {
    throw new Error(`wechat errcode ${j.errcode}: ${j.errmsg ?? "unknown"}`);
  }
  return j as T;
}
