-- 初始化（V2.0 schema 整理后的 from-scratch 迁移）
-- 替代旧的 0000_superb_doctor_octopus + 0001_messy_cable + 0002_phone_bind
-- 顺序：先无外键的表，再 FK 依赖表，最后索引 / 虚表 / 触发器

-- ============ 1. base tables (无外键) ============

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_seen_at` text,
	`privacy_accepted_at` text
);
--> statement-breakpoint
CREATE TABLE `slips` (
	`number` integer PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`poem` text NOT NULL,
	`default_reading` text NOT NULL,
	`category_readings` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gua64` (
	`number` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`upper` text NOT NULL,
	`lower` text NOT NULL,
	`pan_ci` text NOT NULL,
	`yao_ci` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cron_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_name` text NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`affected_rows` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `wechat_token` (
	`type` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint

-- ============ 2. user-bound tables (FK → users) ============

CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`nickname` text NOT NULL,
	`avatar_url` text,
	`gender` text NOT NULL,
	`birth_date` text NOT NULL,
	`birth_time` text NOT NULL,
	`birth_calendar` text DEFAULT 'solar' NOT NULL,
	`birth_place` text NOT NULL,
	`current_address` text,
	`bazi_pillars` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `phone_bind` (
	`user_id` text PRIMARY KEY NOT NULL,
	`phone_e164` text NOT NULL,
	`bound_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_changed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wechat_bind` (
	`user_id` text PRIMARY KEY NOT NULL,
	`openid` text NOT NULL,
	`unionid` text,
	`nickname` text,
	`avatar_url` text,
	`raw_userinfo` text,
	`bound_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_synced_at` text,
	`last_oa_error` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wechat_template_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template_id` text NOT NULL,
	`template_data` text,
	`sent_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`status` text NOT NULL,
	`raw_response` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- ============ 3. conversations + messages（依赖 users / profiles）============

CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text,
	`title` text NOT NULL,
	`summary` text,
	`summary_msg_count` integer DEFAULT 0 NOT NULL,
	`last_intent` text,
	`last_message_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`intent` text,
	`metadata` text,
	`profile_id_used` text,
	`tokens_used` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id_used`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

-- ============ 4. profile-bound tables (FK → profiles) ============

CREATE TABLE `fortunes_daily` (
	`profile_id` text NOT NULL,
	`date` text NOT NULL,
	`overall` integer NOT NULL,
	`scores` text NOT NULL,
	`one_liner` text,
	`attributes` text NOT NULL,
	`reading` text NOT NULL,
	`generated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`profile_id`, `date`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "fortunes_daily_overall_range" CHECK("fortunes_daily"."overall" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE `fortunes_weekly` (
	`profile_id` text NOT NULL,
	`week_start` text NOT NULL,
	`overall` integer,
	`scores` text,
	`one_liner` text,
	`reading` text,
	`generated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`profile_id`, `week_start`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fortunes_monthly` (
	`profile_id` text NOT NULL,
	`month` text NOT NULL,
	`overall` integer,
	`scores` text,
	`one_liner` text,
	`reading` text,
	`generated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`profile_id`, `month`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- ============ 5. messages FTS5 全文索引（虚表 + sync triggers）============

CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='trigram'
);
--> statement-breakpoint
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
--> statement-breakpoint
CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
--> statement-breakpoint

-- ============ 6. 索引 ============

CREATE INDEX `idx_conversations_user_time` ON `conversations` (`user_id`,"last_message_at" DESC);--> statement-breakpoint
CREATE INDEX `idx_cron_runs_task_time` ON `cron_runs` (`task_name`,"started_at" DESC);--> statement-breakpoint
CREATE INDEX `idx_messages_conv_time` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_intent_time` ON `messages` (`intent`,"created_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX `phone_bind_phone_e164_unique` ON `phone_bind` (`phone_e164`);--> statement-breakpoint
CREATE INDEX `idx_phone_bind_phone` ON `phone_bind` (`phone_e164`);--> statement-breakpoint
CREATE INDEX `idx_profiles_user_default` ON `profiles` (`user_id`,"is_default" DESC);--> statement-breakpoint
CREATE INDEX `idx_template_log_user_time` ON `wechat_template_log` (`user_id`,"sent_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_wechat_bind_openid` ON `wechat_bind` (`openid`);--> statement-breakpoint
CREATE INDEX `idx_wechat_bind_unionid` ON `wechat_bind` (`unionid`);
