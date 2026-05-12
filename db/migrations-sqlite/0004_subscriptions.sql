-- 2026-05-12 — subscriptions 会员表
--
-- 记录用户会员状态：
--   plan: "free" | "premium"
--   expires_at: ISO 8601 过期时间，null 表示永不过期
--   provider: "wechat_pay" | "manual" 等
--   trade_no: 支付平台交易号

CREATE TABLE `subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `plan` text DEFAULT 'free' NOT NULL,
  `started_at` text,
  `expires_at` text,
  `provider` text,
  `trade_no` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_subscriptions_user` ON `subscriptions` (`user_id`);
