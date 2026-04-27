/**
 * SSE 6 事件协议（M2.15, spec §4.8）
 *
 * 与 Web SSE 规范对齐：每帧 `event: <name>\ndata: <json>\n\n`；
 * heartbeat 用注释帧 `: ping\n\n`，浏览器忽略，但能阻止反向代理 60s 切连。
 *
 * 6 events：
 *  - meta     {conversationId, intent, source}      初始路由信息
 *  - token    "<chunk>"                             chat 流式片段
 *  - card     {id, role, content, metadata}         非 chat 引导/结果卡
 *  - progress {stage, percent?}                     长任务进度（八字/梅花）
 *  - done     {}                                    流结束
 *  - error    {message, retryable?}                 兜底失败
 */

const ENCODER = new TextEncoder();

export type SseEvent = "meta" | "token" | "card" | "progress" | "done" | "error";

export function frame(event: SseEvent, data: unknown): Uint8Array {
  return ENCODER.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** 注释帧 — 浏览器忽略，但保活 keep-alive 不让代理切连（防御 #18）*/
export function heartbeat(): Uint8Array {
  return ENCODER.encode(`: ping\n\n`);
}

/**
 * SSE response headers — Next.js streaming 必须的几个 header。
 * 特别是 X-Accel-Buffering: no（关 nginx 缓冲）和 Cache-Control: no-cache。
 */
export const SSE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * 安全 enqueue：流被 cancel 后 enqueue 会抛 TypeError，吞掉避免污染日志（防御 #11）。
 */
export function safeEnqueue(
  controller: ReadableStreamDefaultController<Uint8Array>,
  chunk: Uint8Array,
): boolean {
  try {
    controller.enqueue(chunk);
    return true;
  } catch {
    return false;
  }
}
