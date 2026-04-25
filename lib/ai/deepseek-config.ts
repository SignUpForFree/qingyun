import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

/**
 * DeepSeek provider 工厂。
 *
 * 从环境变量读取 DEEPSEEK_API_KEY；P1 单测全 mock，不需要真实 key；
 * 部署到 Vercel 时由平台环境变量提供。
 */
export function getDeepseek() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置 — 请填到 .env.local（W2 起需要）");
  }
  return createOpenAICompatible({
    name: "deepseek",
    baseURL: DEEPSEEK_BASE_URL,
    apiKey,
  });
}
