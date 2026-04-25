/**
 * Prompt 模板渲染 + 加载入口
 *
 * P1 阶段：仅 `renderTemplate` 纯函数可用 + 内存覆盖型 `setPromptForTest`，
 * 真正的 `loadPrompt`（从 Supabase prompts 表读取）等 B5 完成后实装。
 */

export interface PromptRecord {
  key: string;
  version: number;
  systemPrompt: string;
  userPromptTpl: string;
}

const cache = new Map<string, PromptRecord>();

export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => {
    if (k in vars) return String(vars[k]);
    console.warn(`prompt 模板缺失变量: ${k}`);
    return m;
  });
}

/**
 * 测试 / 本地开发时把 prompt 直接塞进缓存，绕过 Supabase。
 * 生产路径请用 loadPrompt（B5 后实装）。
 */
export function setPromptForTest(rec: PromptRecord): void {
  cache.set(rec.key, rec);
}

export function getCachedPrompt(key: string): PromptRecord | undefined {
  return cache.get(key);
}

/** 测试用：清缓存 */
export function clearPromptCache(): void {
  cache.clear();
}

/**
 * P1 占位：B5 之前不可用。
 * 调用方在 P2 D3 prompts seed 完成后通过 createAdmin().from('prompts') 实装。
 */
export async function loadPrompt(key: string): Promise<PromptRecord> {
  const hit = cache.get(key);
  if (hit) return hit;
  throw new Error(
    `loadPrompt 未实装（P1 占位）— B5 之后才可从 Supabase 取 prompt: ${key}。当前请用 setPromptForTest 注入。`,
  );
}
