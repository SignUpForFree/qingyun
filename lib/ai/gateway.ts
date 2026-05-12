import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * AI Gateway 配置 — 通用 OpenAI 兼容接口
 *
 * 支持任意 OpenAI 兼容上游：
 *   - DeepSeek 官方 (https://api.deepseek.com)
 *   - ofox.ai / one-api / new-api / openrouter 等聚合网关
 *   - 自建 LiteLLM / openai-forward 代理
 *
 * 配置优先级（从高到低）：
 *   AI_GATEWAY_*  >  DEEPSEEK_*  >  默认值
 *
 * 切换聚合网关时只需在 .env.prod 改 3 行：
 *   AI_GATEWAY_BASE_URL=https://api.ofox.ai/v1
 *   AI_GATEWAY_API_KEY=sk-of-xxxxxxxx
 *   AI_GATEWAY_MODEL=deepseek/deepseek-v4-pro   # ofox 用 provider/model 命名空间
 *
 * Thinking（reasoning_content）控制：
 *   DeepSeek v4 Pro 默认开启 thinking，每条消息会额外消耗 ~36 reasoning_tokens
 *   （即便回 "好" 一个字也是）。账单按输出 tokens 计费 → 闲聊场景烧 2-3 倍 token。
 *   通过 OpenAI compatible 协议没有原生 thinking 字段，用 fetch 钩子拦截
 *   request body 注入 `thinking: { type: "disabled" | "enabled" }`，DeepSeek 识别。
 */

export const AI_MODEL =
  process.env.AI_GATEWAY_MODEL ??
  process.env.DEEPSEEK_MODEL ??
  "deepseek-chat";

const AI_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL ??
  process.env.DEEPSEEK_BASE_URL ??
  "https://api.deepseek.com";

/** 备用网关配置（主出错时尝试） */
export const AI_BACKUP_MODEL = process.env.AI_GATEWAY_BACKUP_MODEL ?? AI_MODEL;
const AI_BACKUP_BASE_URL = process.env.AI_GATEWAY_BACKUP_BASE_URL ?? "";
const AI_BACKUP_API_KEY = process.env.AI_GATEWAY_BACKUP_API_KEY ?? "";

export type Lane = "primary" | "backup";

/** thinking 模式：disabled = 不思考省 token；enabled = 开 reasoning 用于复杂推理 */
export type ThinkingMode = "disabled" | "enabled";

const cache: Partial<
  Record<`${Lane}:${ThinkingMode}`, ReturnType<typeof createOpenAICompatible>>
> = {};

/** 是否配了 backup 网关 */
export function hasBackupGateway(): boolean {
  return Boolean(AI_BACKUP_BASE_URL && AI_BACKUP_API_KEY);
}

/** 取 lane 对应的 model（主备可能用不同模型） */
export function modelForLane(lane: Lane): string {
  return lane === "backup" ? AI_BACKUP_MODEL : AI_MODEL;
}

/**
 * 网关 provider 工厂（带 thinking 模式开关 + 主备车道）
 *
 * - lane=primary：AI_GATEWAY_*（缺时回 DEEPSEEK_*）
 * - lane=backup：AI_GATEWAY_BACKUP_*（无 → 抛错；调用方在 hasBackupGateway() 为 false 时不应该走 backup）
 * - thinking 默认 disabled：闲聊 / 引导卡 / 简单回复都不需要 reasoning
 *   业务侧（八字/梅花/解梦深度解读）显式传 enabled
 */
export function getGateway(thinking: ThinkingMode = "disabled", lane: Lane = "primary") {
  const cacheKey = `${lane}:${thinking}` as const;
  const cached = cache[cacheKey];
  if (cached) return cached;

  let baseURL: string;
  let apiKey: string;
  if (lane === "backup") {
    if (!hasBackupGateway()) {
      throw new Error(
        "AI backup gateway 未配置 — 请填 AI_GATEWAY_BACKUP_BASE_URL / AI_GATEWAY_BACKUP_API_KEY",
      );
    }
    baseURL = AI_BACKUP_BASE_URL;
    apiKey = AI_BACKUP_API_KEY;
  } else {
    baseURL = AI_BASE_URL;
    const k = process.env.AI_GATEWAY_API_KEY ?? process.env.DEEPSEEK_API_KEY;
    if (!k) {
      throw new Error(
        "AI 网关 key 未配置 — 请在 .env.local / .env.prod 填 AI_GATEWAY_API_KEY 或 DEEPSEEK_API_KEY",
      );
    }
    apiKey = k;
  }

  const provider = createOpenAICompatible({
    name: lane === "backup" ? "ai-gateway-backup" : "ai-gateway",
    baseURL,
    apiKey,
    // fetch 钩子：在 body 里注入 thinking 字段，DeepSeek v4 Pro 识别
    fetch: (async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          if (Array.isArray((body as { messages?: unknown }).messages) && !("thinking" in body)) {
            (body as { thinking?: unknown }).thinking = { type: thinking };
            init = { ...init, body: JSON.stringify(body) };
          }
        } catch {
          /* 不是 JSON / parse 失败 → 透传 */
        }
      }
      return fetch(input, init);
    }) as typeof fetch,
  });

  cache[cacheKey] = provider;
  return provider;
}

/** 测试用：清缓存让下次 getGateway 重新读 env */
export function resetGatewayCache(): void {
  for (const k of Object.keys(cache) as Array<keyof typeof cache>) {
    cache[k] = undefined;
  }
}
