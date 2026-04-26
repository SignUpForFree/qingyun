ALTER TABLE `conversations` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `summary_msg_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `last_intent` text;