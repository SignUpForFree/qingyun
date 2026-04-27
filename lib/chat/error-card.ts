import "server-only";

/**
 * 统一错误兜底（M2.28, spec §4.4 error_card）
 *
 * 6 种错误码（与 SSE error event 同名）：
 *   ai_timeout / ai_rate_limit / user_rate_limit / content_safety / network / unknown
 *
 * - JSON 响应（非 SSE 路径）：`{ error: msg, errorCard: { ui:"error_card", ... } }`
 * - SSE 路径：直接用 frame("error", {...}) 由各 route 处理（已实现）
 *
 * 设计：让前端 ChatWindow 在 catch 到非 200 响应时，可以选择读 errorCard 字段直
 * 接渲染 error_card；老调用方读 error 字段也仍然兼容。
 */

export type ErrorCardCode =
  | "ai_timeout"
  | "ai_rate_limit"
  | "user_rate_limit"
  | "content_safety"
  | "network"
  | "unknown";

export interface ErrorCardMeta {
  ui: "error_card";
  code: ErrorCardCode;
  message: string;
  retryable: boolean;
}

const RETRYABLE: Record<ErrorCardCode, boolean> = {
  ai_timeout: true,
  ai_rate_limit: true,
  user_rate_limit: false,
  content_safety: false,
  network: true,
  unknown: true,
};

const FRIENDLY_MSG: Record<ErrorCardCode, string> = {
  ai_timeout: "AI 演算超时，请重试",
  ai_rate_limit: "AI 通道排队中，请稍后重试",
  user_rate_limit: "你今天问得有点多，喘口气再来",
  content_safety: "提到了不太能聊的内容，换个角度试试",
  network: "网络抖了一下，请重试",
  unknown: "AI 卡了一下，请稍后再试",
};

export function buildErrorCard(
  code: ErrorCardCode,
  customMessage?: string,
): ErrorCardMeta {
  return {
    ui: "error_card",
    code,
    message: customMessage ?? FRIENDLY_MSG[code],
    retryable: RETRYABLE[code],
  };
}

/**
 * 包装一个标准 JSON 错误响应。`status` 由调用方按 code 决定（429 / 400 / 500…）。
 */
export function errorCardResponse(
  code: ErrorCardCode,
  status: number,
  customMessage?: string,
): Response {
  const card = buildErrorCard(code, customMessage);
  return new Response(
    JSON.stringify({
      error: card.message,
      errorCard: card,
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * 判断 e 是否是 AI timeout / abort 异常（用于 SSE catch 分支）
 */
export function isTimeoutError(e: unknown): boolean {
  return e instanceof Error && /timeout|abort/i.test(e.message);
}
