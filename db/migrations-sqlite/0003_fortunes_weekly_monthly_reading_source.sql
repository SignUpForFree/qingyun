-- 2026-05-07 — fortunes_weekly / fortunes_monthly 增加 reading_source 列
-- 与 0002_fortunes_reading_source.sql 同义，扩展到周 / 月
--
-- 取值：
--   "fallback" — 本地模板池兜底（buildReadingFallback）
--   "ai"      — DeepSeek v4 Pro 生成（buildFortuneReadingPrompt）
--
-- 默认 "fallback" 与现有所有行兼容

ALTER TABLE `fortunes_weekly` ADD COLUMN `reading_source` text DEFAULT 'fallback' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fortunes_monthly` ADD COLUMN `reading_source` text DEFAULT 'fallback' NOT NULL;
