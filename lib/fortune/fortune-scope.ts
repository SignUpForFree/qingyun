/**
 * 运势详情 scope（纯类型 + URL 解析，可被客户端安全 import）
 */
export type FortuneDetailScope = "day" | "week" | "month";

/** 解析 URL ?scope= ，非法则 day */
export function parseFortuneScope(raw: string | undefined): FortuneDetailScope {
  if (raw === "week" || raw === "month") return raw;
  return "day";
}
