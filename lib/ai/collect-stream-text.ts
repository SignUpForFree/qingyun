import { stripThinkChain } from "./strip-think-chain";

/** 历史占位文案（旧版 route 写入）；客户端需识别并拒绝展示 */
export const DREAM_LEGACY_EMPTY_PLACEHOLDER = "(AI 解梦未生成)";

export function isDreamEmptyContent(text: string): boolean {
  const t = text.trim();
  return !t || t === DREAM_LEGACY_EMPTY_PLACEHOLDER || t.includes(DREAM_LEGACY_EMPTY_PLACEHOLDER);
}

export interface CollectStreamTextInput {
  textStream: AsyncIterable<string>;
  text: PromiseLike<string>;
  fullStream?: AsyncIterable<{ type: string; text?: string }>;
  usage: PromiseLike<{ totalTokens?: number | null }>;
  finishReason: PromiseLike<string>;
}

/**
 * 从 streamText 结果收集可见正文：
 * 1. textStream 增量
 * 2. 若空则 fullStream 的 text-delta（部分 OpenAI 兼容网关只走这条）
 * 3. 若仍空则 stream.text 聚合
 * 最后 stripThinkChain，避免思考链占满正文。
 */
export async function collectStreamText(
  stream: CollectStreamTextInput,
  onToken?: (chunk: string) => void,
): Promise<{ text: string; tokens: number; finishReason?: string }> {
  let text = "";

  try {
    for await (const chunk of stream.textStream) {
      text += chunk;
      onToken?.(chunk);
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    console.warn("[collectStreamText] textStream failed", e);
  }

  let tokens = 0;
  let finishReason: string | undefined;
  try {
    tokens = (await stream.usage).totalTokens ?? 0;
  } catch {
    /* usage 不致命 */
  }
  try {
    finishReason = await stream.finishReason;
  } catch {
    /* finishReason 不致命 */
  }

  if (!text.trim()) {
    try {
      const full = stripThinkChain((await stream.text).trim());
      if (full) {
        console.warn("[collectStreamText] recovered via stream.text", {
          finishReason,
          len: full.length,
          tokens,
        });
        text = full;
        onToken?.(full);
      }
    } catch (e) {
      console.warn("[collectStreamText] stream.text failed", e);
    }
  }

  if (!text.trim() && stream.fullStream) {
    try {
      for await (const part of stream.fullStream) {
        if (part.type === "text-delta" && part.text) {
          text += part.text;
          onToken?.(part.text);
        }
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      console.warn("[collectStreamText] fullStream failed", e);
    }
  }

  return { text: stripThinkChain(text).trim(), tokens, finishReason };
}
