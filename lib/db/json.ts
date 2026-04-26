/**
 * SQLite text 列存 JSON 的 helper
 *
 * - parseJson(text, fallback)  把 text 解析为 unknown，失败返 fallback
 * - serializeJson(value) 直接 JSON.stringify
 */

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}
