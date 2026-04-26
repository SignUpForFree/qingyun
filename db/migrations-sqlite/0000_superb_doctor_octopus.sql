CREATE TABLE `bazi_charts` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`pillars` text NOT NULL,
	`five_elements` text NOT NULL,
	`day_master` text NOT NULL,
	`ten_gods` text NOT NULL,
	`favorable_gods` text,
	`luck_pillars` text,
	`solar_true_time` text NOT NULL,
	`raw` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bazi_charts_profile_id_unique` ON `bazi_charts` (`profile_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text,
	`title` text,
	`last_message_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `conversations_user_recent_idx` ON `conversations` (`user_id`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `divination_records` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`type` text NOT NULL,
	`input` text NOT NULL,
	`result` text NOT NULL,
	`ai_reading` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `divination_records_message_id_unique` ON `divination_records` (`message_id`);--> statement-breakpoint
CREATE TABLE `divination_slips` (
	`number` integer PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`poem` text NOT NULL,
	`readings` text NOT NULL,
	`image_url` text
);
--> statement-breakpoint
CREATE TABLE `fortunes` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`fortune_date` text NOT NULL,
	`score_overall` integer,
	`scores` text,
	`one_liner` text,
	`readings` text,
	`attributes` text,
	`model` text,
	`tokens_used` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fortunes_profile_date_uq` ON `fortunes` (`profile_id`,`fortune_date`);--> statement-breakpoint
CREATE TABLE `hexagrams` (
	`number` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`upper_trigram` text NOT NULL,
	`lower_trigram` text NOT NULL,
	`upper_wuxing` text NOT NULL,
	`lower_wuxing` text NOT NULL,
	`judgment` text NOT NULL,
	`image` text NOT NULL,
	`lines` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`intent` text,
	`metadata` text,
	`tokens_used` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conv_time_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nickname` text,
	`gender` text,
	`birth_time` text,
	`calendar_type` text DEFAULT 'solar',
	`birth_province` text,
	`birth_city` text,
	`birth_district` text,
	`birth_longitude` real,
	`birth_latitude` real,
	`current_location` text,
	`avatar_url` text,
	`is_default` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profiles_user_default_idx` ON `profiles` (`user_id`,`is_default`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`system_prompt` text NOT NULL,
	`user_prompt_tpl` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompts_key_version_uq` ON `prompts` (`key`,`version`);--> statement-breakpoint
CREATE INDEX `prompts_key_active_idx` ON `prompts` (`key`,`active`);