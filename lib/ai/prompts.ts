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
 * 从 prompts 表加载 active 的最新版本
 *
 * - 缓存命中直接返回
 * - miss 则查 SQLite (lib/db/seed.ts 启动时已 idempotent 写入种子)
 */
export async function loadPrompt(key: string): Promise<PromptRecord> {
  const hit = cache.get(key);
  if (hit) return hit;

  const { getDb } = await import("@/lib/db/client");
  const { prompts } = await import("@/lib/db/schema");
  const { and, eq, desc } = await import("drizzle-orm");

  const db = getDb();
  const rows = await db
    .select({
      key: prompts.key,
      version: prompts.version,
      system_prompt: prompts.system_prompt,
      user_prompt_tpl: prompts.user_prompt_tpl,
    })
    .from(prompts)
    .where(and(eq(prompts.key, key), eq(prompts.active, true)))
    .orderBy(desc(prompts.version))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(`prompts 表未找到 key=${key} 的 active 记录`);
  }

  const rec: PromptRecord = {
    key: row.key,
    version: row.version,
    systemPrompt: row.system_prompt,
    userPromptTpl: row.user_prompt_tpl,
  };
  cache.set(key, rec);
  return rec;
}
