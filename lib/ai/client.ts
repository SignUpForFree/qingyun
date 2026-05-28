import { streamText, type ModelMessage } from "ai";
import {
  hasBackupGateway,
  getGateway,
  modelForLane,
  type Lane,
  type ThinkingMode,
} from "./gateway";

type StreamTextRet = ReturnType<typeof streamText>;

export interface ChatInput {
  messages: ModelMessage[];
  systemPrompt?: string;
  temperature?: number;
  /** true = 返回原始 streamText result（调用方负责消费/转发）；false = 拼成 text */
  stream?: boolean;
  /** 调用方上下文，用于落库 / 打点 */
  meta?: { conversationId?: string; userId?: string };
  /**
   * DeepSeek v4 Pro reasoning 模式开关（disabled = 不思考省 token，enabled = 复杂推理）
   *
   * 默认 disabled：闲聊 / 引导卡 / 短回复都不需要 reasoning，可节省 ~50%+ token 成本
   * （参 ARCHITECTURE.md §3.2-B：v4 Pro 默认开 reasoning，回 1 字也烧 36 reasoning tokens）。
   * 业务侧建议：
   *   - "chat" 闯聊：disabled（默认）
   *   - "bazi" / "meihua" / 八字深度解读：enabled（命盘信息多，需要推理）
   *   - "dream" 解梦：disabled（梦境短，模式化处理够了）
   *   - "divination" 抽签：disabled（卦词已是固定文本，AI 只做包装）
   */
  thinking?: ThinkingMode;
  /**
   * 外部 abort 信号 — 客户端断流（用户关页 / 主动取消 SSE）时让上游 DeepSeek 调用立刻
   * 取消，避免 token 持续浪费到 stream 自然结束（最坏 60s）。
   * 与内部超时 timer 一起工作：任意一方 abort 都会触发 fetch 取消。
   */
  abortSignal?: AbortSignal;
  /** 覆盖默认 AI_TIMEOUT_MS（解梦等长 TTFT 场景可单独加长） */
  timeoutMs?: number;
  /** 限制输出 token，缩短生成时间（解梦 fast 建议 1200 左右） */
  maxOutputTokens?: number;
}

export interface ChatNonStreamResult {
  text: string;
  tokensUsed: number;
}

// 默认 60s。30s 太紧（CLAUDE.md §3 #2）：八字/梅花长 prompt 经常 25s+，30s
// 会以 30s 整命中 abort，前端落到 fallback 文案，看上去像 AI 报错实则超时。
// lib/env.ts 也强制最小 60000，保持一致。
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 60_000);
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
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  // 串接外部 signal：客户端断流 → 立刻 abort 内部 controller → 取消上游 fetch
  const onExternalAbort = () => ac.abort();
  if (input.abortSignal) {
    if (input.abortSignal.aborted) {
      ac.abort();
    } else {
      input.abortSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  /**
   * 网关 try：lane=primary 默认；non-stream 路径在 primary 失败后会自动切 backup
   *（如果配了 AI_GATEWAY_BACKUP_*）。stream 路径 lazy，失败由调用方 try/catch
   * 处理，先不做主备切换（避免 SSE 半途切换的复杂度）。
   */
  const tryLane = (lane: Lane) => {
    const gateway = getGateway(input.thinking ?? "disabled", lane);
    return streamText({
      model: gateway(modelForLane(lane)),
      messages: fullMessages,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      abortSignal: ac.signal,
      maxOutputTokens: input.maxOutputTokens,
    });
  };

  try {
    const result = tryLane("primary");

    if (input.stream) {
      return result;
    }

    let text = "";
    let tokensUsed = 0;
    try {
      for await (const chunk of result.textStream) text += chunk;
      tokensUsed = (await result.usage).totalTokens ?? 0;
      return { text, tokensUsed };
    } catch (primaryErr) {
      if ((primaryErr as Error)?.name === "AbortError") throw primaryErr;
      console.warn("[ai] primary failed", primaryErr);

      if (!hasBackupGateway()) {
        throw primaryErr;
      }
      console.info("[ai] retry on backup gateway");
      const backup = tryLane("backup");
      let text2 = "";
      for await (const chunk of backup.textStream) text2 += chunk;
      const usage2 = await backup.usage;
      return {
        text: text2 || FALLBACK_TEXT,
        tokensUsed: usage2.totalTokens ?? 0,
      };
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      // 让调用方识别（路由层 catch 静默处理）
      throw err;
    }
    // stream 路径需要真实 StreamTextRet；吞错会变成 undefined.textStream → 前端 "AI 卡了一下"
    if (input.stream) throw err;
    console.error("AI Gateway 失败", err);
    return {
      text: FALLBACK_TEXT,
      tokensUsed: 0,
    };
  } finally {
    clearTimeout(timer);
    if (input.abortSignal) {
      input.abortSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export const __TEST__ = { FALLBACK_TEXT, DEFAULT_TEMPERATURE, DEFAULT_TIMEOUT_MS };
