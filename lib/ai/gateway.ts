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
 */

export const AI_MODEL =
  process.env.AI_GATEWAY_MODEL ??
  process.env.DEEPSEEK_MODEL ??
  "deepseek-chat";

const AI_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL ??
  process.env.DEEPSEEK_BASE_URL ??
  "https://api.deepseek.com";

/**
 * 网关 provider 工厂
 *
 * - 优先 AI_GATEWAY_API_KEY，缺失退回 DEEPSEEK_API_KEY（兼容老配置）
 * - 都没有 → 抛错，调用方用 try/catch 回退到 fallback 文本
 * - name 用于 ai sdk 内部标识，与具体上游无关
 */
export function getGateway() {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI 网关 key 未配置 — 请在 .env.local / .env.prod 填 AI_GATEWAY_API_KEY 或 DEEPSEEK_API_KEY",
    );
  }
  return createOpenAICompatible({
    name: "ai-gateway",
    baseURL: AI_BASE_URL,
    apiKey,
  });
}
