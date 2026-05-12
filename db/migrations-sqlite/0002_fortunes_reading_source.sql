-- 2026-05-04 — fortunes_daily 增加 reading_source 列（运势 reading AI 化方案）
-- 详见 docs/superpowers/specs/2026-05-04-fortune-reading-ai-mcp.md §3
--
-- 取值：
--   "fallback" — 本地模板池兜底（lib/fortune/reading-fallback.ts，21 选 1 hash）
--   "ai"      — DeepSeek v4 Pro 生成（lib/ai/prompts/fortune-reading.ts）
--
-- 客户端 ReadingAutoRegen 检测 != "ai" 时一次性触发 /api/fortune/today/regenerate
-- 默认 "fallback" 与现有所有行兼容（之前都是 fallback 写入的）

ALTER TABLE `fortunes_daily` ADD COLUMN `reading_source` text DEFAULT 'fallback' NOT NULL;
