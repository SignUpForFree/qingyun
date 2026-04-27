import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * V2.0 SQLite Schema (drizzle ORM) — 14 tables per spec §2.2
 *
 * Reference: docs/superpowers/specs/2026-04-27-qingyun-full-impl-design.md
 *
 * 设计原则（spec §2.1）:
 *   - wipe + 重建：不写迁移脚本，schema 一次到位（V1.0 数据丢弃）
 *   - 所有 PK 用 text uuid v4（crypto.randomUUID()）；timestamps 用 ISO 8601 文本
 *   - JSON 字段用 text 列存（lib/db/json.ts 的 parse/serialize helper）
 *   - bool → integer({ mode: "boolean" })
 *   - 删除策略（spec §2.3 #2）:
 *       注销 user → CASCADE 全清
 *       删档案 → fortunes_*.profile_id CASCADE; conversations.profile_id /
 *                messages.profile_id_used SET NULL（保留历史）
 */

const tsNow = (name: string) =>
  text(name)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// ---------- 1. users ----------
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  created_at: tsNow("created_at"),
  updated_at: tsNow("updated_at"),
  last_seen_at: text("last_seen_at"),
  privacy_accepted_at: text("privacy_accepted_at"),
});

// ---------- 2. wechat_bind ----------
export const wechatBind = sqliteTable(
  "wechat_bind",
  {
    user_id: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    openid: text("openid").notNull(),
    unionid: text("unionid"),
    nickname: text("nickname"),
    avatar_url: text("avatar_url"),
    raw_userinfo: text("raw_userinfo"), // JSON
    bound_at: tsNow("bound_at"),
    last_synced_at: text("last_synced_at"),
    last_oa_error: text("last_oa_error"),
  },
  (t) => [
    // openid UNIQUE 用 uniqueIndex 命名（spec §2.4 / 避免 .unique() 自动生成 + 显式 index 重复建索引）
    uniqueIndex("idx_wechat_bind_openid").on(t.openid),
    index("idx_wechat_bind_unionid").on(t.unionid),
  ],
);

// ---------- 3. phone_bind ----------
export const phoneBind = sqliteTable(
  "phone_bind",
  {
    user_id: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    phone_e164: text("phone_e164").notNull().unique(),
    bound_at: tsNow("bound_at"),
    last_changed_at: text("last_changed_at"),
  },
  (t) => [index("idx_phone_bind_phone").on(t.phone_e164)],
);

// ---------- 4. profiles ----------
export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // is_default：业务约束「每个 user_id 至多 1 行 is_default = 1」由应用层 setDefault() 在事务内保证
    // （spec §2.2 #4 / §2.3 #2）；schema 层不加 partial unique index 是因为 SQLite 0.45 drizzle 没有简洁 DSL
    is_default: integer("is_default", { mode: "boolean" }).notNull().default(false),
    nickname: text("nickname").notNull(),
    avatar_url: text("avatar_url"),
    gender: text("gender", { enum: ["male", "female", "other"] }).notNull(),
    birth_date: text("birth_date").notNull(),
    birth_time: text("birth_time").notNull(),
    birth_calendar: text("birth_calendar", { enum: ["solar", "lunar"] })
      .notNull()
      .default("solar"),
    birth_place: text("birth_place").notNull(),
    current_address: text("current_address"),
    bazi_pillars: text("bazi_pillars"), // JSON cache (avoid recomputing lunar.js)
    created_at: tsNow("created_at"),
    updated_at: tsNow("updated_at"),
  },
  (t) => [index("idx_profiles_user_default").on(t.user_id, sql`${t.is_default} DESC`)],
);

// ---------- 5. conversations ----------
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profile_id: text("profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    summary: text("summary"),
    summary_msg_count: integer("summary_msg_count").notNull().default(0),
    last_intent: text("last_intent"),
    last_message_at: text("last_message_at"),
    created_at: tsNow("created_at"),
  },
  (t) => [index("idx_conversations_user_time").on(t.user_id, sql`${t.last_message_at} DESC`)],
);

// ---------- 6. messages ----------
export const messages = sqliteTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversation_id: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    intent: text("intent", { enum: ["chat", "divination", "dream", "bazi", "meihua"] }),
    metadata: text("metadata"), // JSON
    profile_id_used: text("profile_id_used").references(() => profiles.id, {
      onDelete: "set null",
    }),
    tokens_used: integer("tokens_used").notNull().default(0),
    created_at: tsNow("created_at"),
  },
  (t) => [
    index("idx_messages_conv_time").on(t.conversation_id, t.created_at),
    index("idx_messages_intent_time").on(t.intent, sql`${t.created_at} DESC`),
  ],
);

// ---------- 7. fortunes_daily ----------
export const fortunesDaily = sqliteTable(
  "fortunes_daily",
  {
    profile_id: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    overall: integer("overall").notNull(),
    scores: text("scores").notNull(), // JSON
    one_liner: text("one_liner"),
    attributes: text("attributes").notNull(), // JSON
    reading: text("reading").notNull(),
    generated_at: tsNow("generated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.profile_id, t.date] }),
    check("fortunes_daily_overall_range", sql`${t.overall} BETWEEN 0 AND 100`),
  ],
);

// ---------- 8. fortunes_weekly ----------
export const fortunesWeekly = sqliteTable(
  "fortunes_weekly",
  {
    profile_id: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    week_start: text("week_start").notNull(),
    overall: integer("overall"),
    scores: text("scores"), // JSON
    one_liner: text("one_liner"),
    reading: text("reading"),
    generated_at: tsNow("generated_at"),
  },
  (t) => [primaryKey({ columns: [t.profile_id, t.week_start] })],
);

// ---------- 9. fortunes_monthly ----------
export const fortunesMonthly = sqliteTable(
  "fortunes_monthly",
  {
    profile_id: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    overall: integer("overall"),
    scores: text("scores"), // JSON
    one_liner: text("one_liner"),
    reading: text("reading"),
    generated_at: tsNow("generated_at"),
  },
  (t) => [primaryKey({ columns: [t.profile_id, t.month] })],
);

// ---------- 10. slips（100 签字典，seed 后只读） ----------
export const slips = sqliteTable("slips", {
  number: integer("number").primaryKey(),
  level: text("level", {
    enum: ["上上", "上吉", "中吉", "中平", "下下"],
  }).notNull(),
  title: text("title").notNull(),
  poem: text("poem").notNull(),
  default_reading: text("default_reading").notNull(),
  category_readings: text("category_readings").notNull(), // JSON (6 dims)
});

// ---------- 11. gua64（64 卦字典，seed 后只读） ----------
export const gua64 = sqliteTable("gua64", {
  number: integer("number").primaryKey(),
  name: text("name").notNull(),
  upper: text("upper").notNull(),
  lower: text("lower").notNull(),
  pan_ci: text("pan_ci").notNull(),
  yao_ci: text("yao_ci").notNull(), // JSON (6 lines)
});

// ---------- 12. cron_runs ----------
export const cronRuns = sqliteTable(
  "cron_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    task_name: text("task_name").notNull(),
    started_at: tsNow("started_at"),
    finished_at: text("finished_at"),
    status: text("status", { enum: ["running", "success", "failed"] }).notNull(),
    affected_rows: integer("affected_rows"),
    error: text("error"),
  },
  (t) => [index("idx_cron_runs_task_time").on(t.task_name, sql`${t.started_at} DESC`)],
);

// ---------- 13. wechat_template_log ----------
export const wechatTemplateLog = sqliteTable(
  "wechat_template_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    template_id: text("template_id").notNull(),
    template_data: text("template_data"), // JSON
    sent_at: tsNow("sent_at"),
    status: text("status", { enum: ["queued", "sent", "failed"] }).notNull(),
    raw_response: text("raw_response"),
  },
  (t) => [index("idx_template_log_user_time").on(t.user_id, sql`${t.sent_at} DESC`)],
);

// ---------- 14. wechat_token（单例缓存） ----------
export const wechatToken = sqliteTable("wechat_token", {
  type: text("type", { enum: ["access_token", "jsapi_ticket"] }).primaryKey(),
  value: text("value").notNull(),
  expires_at: integer("expires_at").notNull(), // ms epoch
});

// ---------- 类型 export（drizzle $inferSelect / $inferInsert） ----------
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type WechatBind = typeof wechatBind.$inferSelect;
export type WechatBindInsert = typeof wechatBind.$inferInsert;

export type PhoneBind = typeof phoneBind.$inferSelect;
export type PhoneBindInsert = typeof phoneBind.$inferInsert;

export type Profile = typeof profiles.$inferSelect;
export type ProfileInsert = typeof profiles.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

export type FortuneDaily = typeof fortunesDaily.$inferSelect;
export type FortuneDailyInsert = typeof fortunesDaily.$inferInsert;

export type FortuneWeekly = typeof fortunesWeekly.$inferSelect;
export type FortuneWeeklyInsert = typeof fortunesWeekly.$inferInsert;

export type FortuneMonthly = typeof fortunesMonthly.$inferSelect;
export type FortuneMonthlyInsert = typeof fortunesMonthly.$inferInsert;

export type Slip = typeof slips.$inferSelect;
export type SlipInsert = typeof slips.$inferInsert;

export type Gua64 = typeof gua64.$inferSelect;
export type Gua64Insert = typeof gua64.$inferInsert;

export type CronRun = typeof cronRuns.$inferSelect;
export type CronRunInsert = typeof cronRuns.$inferInsert;

export type WechatTemplateLog = typeof wechatTemplateLog.$inferSelect;
export type WechatTemplateLogInsert = typeof wechatTemplateLog.$inferInsert;

export type WechatToken = typeof wechatToken.$inferSelect;
export type WechatTokenInsert = typeof wechatToken.$inferInsert;

