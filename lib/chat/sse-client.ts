/**
 * 客户端 SSE 消费工具 — ChatWindow 的 /api/chat 主流和 sub-action 流共用
 *
 * 服务端协议在 lib/chat/sse.ts (frame/heartbeat/SSE_HEADERS)。
 * 这里只负责从 ReadableStream 解析回 6 事件 (meta/token/card/progress/done/error)。
 */

export interface SseFrame {
  event: string;
  data: unknown;
}

export function parseSseFrame(raw: string): SseFrame | null {
  const lines = raw.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return { event, data: "" };
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

export interface SseCardData {
  id?: string;
  role: "assistant";
  content: string;
  metadata?: string | null;
}

export interface SseProgressData {
  stage?: string;
  percent?: number;
}

export interface SseCallbacks {
  onMeta?: (data: { conversationId?: string; intent?: string; source?: string }) => void;
  /** chunk 仅是当前帧的增量，调用方自己决定累加和节流 */
  onToken?: (chunk: string) => void;
  onCard?: (card: SseCardData) => void;
  onProgress?: (data: SseProgressData) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
}

/**
 * 消费 SSE 流到结束。AbortError 不再抛出，调用方按需检查。
 * 其他异常（网络断流等）原样抛出。
 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  cb: SseCallbacks,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const parsed = parseSseFrame(evt);
      if (!parsed) continue;
      switch (parsed.event) {
        case "meta": {
          if (typeof parsed.data === "object" && parsed.data !== null) {
            cb.onMeta?.(parsed.data as { conversationId?: string });
          }
          break;
        }
        case "token": {
          const chunk = typeof parsed.data === "string" ? parsed.data : "";
          if (chunk) cb.onToken?.(chunk);
          break;
        }
        case "card": {
          if (typeof parsed.data === "object" && parsed.data !== null) {
            const card = parsed.data as SseCardData;
            cb.onCard?.(card);
          }
          break;
        }
        case "progress": {
          if (typeof parsed.data === "object" && parsed.data !== null) {
            cb.onProgress?.(parsed.data as SseProgressData);
          }
          break;
        }
        case "done": {
          cb.onDone?.();
          break;
        }
        case "error": {
          const data = parsed.data;
          const msg =
            typeof data === "string"
              ? data
              : ((data as { message?: string } | null)?.message ?? "");
          cb.onError?.(msg);
          break;
        }
        default:
          break;
      }
    }
  }
}

export function progressStageLabel(stage: string): string {
  if (stage === "computing") return "演算中";
  if (stage === "streaming") return "拟稿中";
  if (stage === "classifying") return "判定中";
  return stage;
}
