/**
 * @deprecated 请使用 lib/ai/gateway.ts；本文件保留只是为了避免老 import 断链。
 *
 * 旧代码做 `import { getDeepseek, DEEPSEEK_MODEL }` 仍可用，
 * 但等同于通用 Gateway，会继承 AI_GATEWAY_* 配置（如有）。
 */
import { AI_MODEL, getGateway } from "./gateway";

export const DEEPSEEK_MODEL = AI_MODEL;
export const getDeepseek = getGateway;
