import { getDb } from "@/lib/db/client";
import { wechatToken } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { wechatFetch } from "./client";

/**
 * 微信 access_token / jsapi_ticket 双层缓存（spec §3.4 / CLAUDE.md 防御 #15）
 *
 * 缓存层级：
 *   1. 进程内 mem (热路径，免去 SQLite I/O)
 *   2. SQLite singleton row（type 为 PK，跨进程/重启共享真理）
 *   3. wechat cgi-bin（远端刷新，写入上述两层）
 *
 * 为什么需要 singleton：每个 APPID 全局只有一个有效 token，多个调用方各自请求会
 * 互相覆盖触发随机 40001。该模块是唯一合法调用方，M1.6 / M1.7 / M5 都从这里取。
 *
 * SAFETY_BUFFER_MS = 60s：wechat 返回的 expires_in（≈7200s）是上限，实际可能提前
 * 轮换。在到期前 60s 主动刷新避免使用即将失效的 token。
 */

type TokenType = "access_token" | "jsapi_ticket";

interface CachedToken {
  value: string;
  expiresAt: number; // ms epoch
}

const mem: Partial<Record<TokenType, CachedToken>> = {};
const SAFETY_BUFFER_MS = 60_000;

async function fetchFresh(type: TokenType): Promise<CachedToken> {
  const env = getEnv();
  if (type === "access_token") {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WECHAT_APPID}&secret=${env.WECHAT_APPSECRET}`;
    const r = await wechatFetch<{ access_token: string; expires_in: number }>(url);
    return { value: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 };
  }
  // jsapi_ticket needs a fresh access_token first; recursion lets it reuse cache.
  const at = await getToken("access_token");
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=${at}`;
  const r = await wechatFetch<{ ticket: string; expires_in: number }>(url);
  return { value: r.ticket, expiresAt: Date.now() + r.expires_in * 1000 };
}

export async function getToken(type: TokenType): Promise<string> {
  // 1. mem cache hit (fast path)
  const mc = mem[type];
  if (mc && Date.now() < mc.expiresAt - SAFETY_BUFFER_MS) return mc.value;

  // 2. SQLite singleton row
  const db = getDb();
  const row = db.$client
    .prepare("SELECT value, expires_at FROM wechat_token WHERE type = ?")
    .get(type) as { value: string; expires_at: number } | undefined;
  if (row && Date.now() < Number(row.expires_at) - SAFETY_BUFFER_MS) {
    mem[type] = { value: row.value, expiresAt: Number(row.expires_at) };
    return row.value;
  }

  // 3. refresh from wechat + write through both tiers
  const fresh = await fetchFresh(type);
  await db
    .insert(wechatToken)
    .values({ type, value: fresh.value, expires_at: fresh.expiresAt })
    .onConflictDoUpdate({
      target: wechatToken.type,
      set: { value: fresh.value, expires_at: fresh.expiresAt },
    });
  mem[type] = fresh;
  return fresh.value;
}

/**
 * 仅供测试调用，清空 process-local mem cache。
 * 生产代码不应导入此函数。
 */
export function __resetMemCacheForTests(): void {
  for (const k of Object.keys(mem) as TokenType[]) delete mem[k];
}
