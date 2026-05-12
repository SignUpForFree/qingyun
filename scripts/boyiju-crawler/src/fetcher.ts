/**
 * 通用 HTTP 请求工具 — 限速 + 重试 + GBK 转码
 */
import { Buffer } from "node:buffer";
import * as iconv from "iconv-lite";

const REQUEST_INTERVAL_MS = 1500;
const MAX_RETRIES = 3;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL_MS) {
    await sleep(REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 抓取页面 HTML，自动处理 GBK 编码
 */
export async function fetchPage(url: string): Promise<string> {
  await rateLimit();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const contentType = res.headers.get("content-type") ?? "";
      const buffer = Buffer.from(await res.arrayBuffer());

      // 检测编码：GBK 页面通常在 content-type 或 meta 里标注
      if (contentType.includes("gbk") || contentType.includes("gb2312")) {
        return iconv.decode(buffer, "gbk");
      }

      // 尝试从 HTML meta 标签检测编码
      const head = buffer.subarray(0, 1024).toString("ascii");
      if (head.includes("gbk") || head.includes("gb2312") || head.includes("GB2312")) {
        return iconv.decode(buffer, "gbk");
      }

      return buffer.toString("utf-8");
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      console.warn(
        `[fetch] attempt ${attempt}/${MAX_RETRIES} failed: ${url} — ${(err as Error).message}`,
      );
      if (isLast) throw err;
      await sleep(1000 * attempt); // 指数退避
    }
  }

  throw new Error(`unreachable: ${url}`);
}
