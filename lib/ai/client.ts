import { streamText, type ModelMessage } from "ai";
import { getDeepseek, DEEPSEEK_MODEL } from "./deepseek-config";

type StreamTextRet = ReturnType<typeof streamText>;

export interface ChatInput {
  messages: ModelMessage[];
  systemPrompt?: string;
  temperature?: number;
  /** true = 返回原始 streamText result（调用方负责消费/转发）；false = 拼成 text */
  stream?: boolean;
  /** 调用方上下文，用于落库 / 打点 */
  meta?: { conversationId?: string; userId?: string };
}

export interface ChatNonStreamResult {
  text: string;
  tokensUsed: number;
}

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 30_000);
const DEFAULT_TEMPERATURE = 0.6;

const FALLBACK_TEXT = "抱歉，AI 卡了一下。请稍后再试一次（这条不计入限额）。";

/**
 * AI 主入口：DeepSeek 流式调用 + 超时 + 友好兜底
 *
 * 行为：
 *   - stream=false：拼接所有 chunk 成完整文本 + 累计 tokens 返回
 *   - stream=true：直接把 streamText 的 result 抛出，调用方决定如何转 SSE
 *   - 任何错误（含超时）回退一句友好文本，tokensUsed=0；调用方需识别 fallback 状态
 */
export async function chat(input: ChatInput & { stream: true }): Promise<StreamTextRet>;
export async function chat(input: ChatInput & { stream?: false }): Promise<ChatNonStreamResult>;
export async function chat(input: ChatInput): Promise<ChatNonStreamResult | StreamTextRet> {
  const fullMessages: ModelMessage[] = input.systemPrompt
    ? [{ role: "system", content: input.systemPrompt }, ...input.messages]
    : input.messages;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const deepseek = getDeepseek();
    const result = streamText({
      model: deepseek(DEEPSEEK_MODEL),
      messages: fullMessages,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      abortSignal: ac.signal,
    });

    if (input.stream) {
      // 流式：调用方拿到 result 后用 result.toUIMessageStreamResponse() / textStream 自行消费
      return result;
    }

    let text = "";
    for await (const chunk of result.textStream) text += chunk;
    const usage = await result.usage;
    return {
      text,
      tokensUsed: usage.totalTokens ?? 0,
    };
  } catch (err) {
    console.error("AI Gateway 失败", err);
    return {
      text: FALLBACK_TEXT,
      tokensUsed: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const __TEST__ = { FALLBACK_TEXT, DEFAULT_TEMPERATURE, DEFAULT_TIMEOUT_MS };
