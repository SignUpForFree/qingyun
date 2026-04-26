import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * SQLite Schema (drizzle ORM)
 *
 * 与 db/migrations/0001-3 的 Postgres 版语义对齐：
 *   - uuid → text (默认 lower(hex(randomblob(16))) 简化)
 *   - timestamptz → text (ISO 字符串, default current_timestamp)
 *   - jsonb → text (调用方 JSON.stringify/parse, 我们在 lib/db/json.ts 包一层 helper)
 *   - bool → integer({ mode: "boolean" })
 *   - check 约束 → drizzle 的 .check() 或文档约定 (SQLite check 支持但 drizzle 0.45 写法稍简单时用注释)
 *   - 外键 cascade 同步保留
 *
 * Auth 因为不再用 Supabase Auth，user_id 改为本地匿名 session 生成的 uuid（无 users 表外键）
 */

const tsNow = (name: string) =>
  text(name)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// ---------- profiles ----------
export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id").notNull(), // 由 lib/auth/session.ts 注入的匿名 user uuid
    nickname: text("nickname"),
    gender: text("gender", { enum: ["male", "female"] }),
    birth_time: text("birth_time"),
    calendar_type: text("calendar_type", { enum: ["solar", "lunar"] }).default("solar"),
    birth_province: text("birth_province"),
    birth_city: text("birth_city"),
    birth_district: text("birth_district"),
    birth_longitude: real("birth_longitude"),
    birth_latitude: real("birth_latitude"),
    current_location: text("current_location"), // JSON
    avatar_url: text("avatar_url"),
    is_default: integer("is_default", { mode: "boolean" }).default(true),
    created_at: tsNow("created_at"),
    updated_at: tsNow("updated_at"),
  },
  (t) => [index("profiles_user_default_idx").on(t.user_id, t.is_default)],
);

// ---------- bazi_charts ----------
export const baziCharts = sqliteTable("bazi_charts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  profile_id: text("profile_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  pillars: text("pillars").notNull(), // JSON
  five_elements: text("five_elements").notNull(), // JSON
  day_master: text("day_master").notNull(),
  ten_gods: text("ten_gods").notNull(), // JSON
  favorable_gods: text("favorable_gods"), // JSON
  luck_pillars: text("luck_pillars"), // JSON
  solar_true_time: text("solar_true_time").notNull(),
  raw: text("raw"), // JSON
  created_at: tsNow("created_at"),
});

// ---------- fortunes ----------
export const fortunes = sqliteTable(
  "fortunes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    profile_id: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    fortune_date: text("fortune_date").notNull(),
    score_overall: integer("score_overall"),
    scores: text("scores"), // JSON
    one_liner: text("one_liner"),
    readings: text("readings"), // JSON
    attributes: text("attributes"), // JSON
    model: text("model"),
    tokens_used: integer("tokens_used"),
    created_at: tsNow("created_at"),
  },
  (t) => [uniqueIndex("fortunes_profile_date_uq").on(t.profile_id, t.fortune_date)],
);

// ---------- conversations ----------
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id").notNull(),
    profile_id: text("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    title: text("title"),
    last_message_at: text("last_message_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    created_at: tsNow("created_at"),
    // M1.1 (2026-04-26)：multi-turn memory + 意图分流
    summary: text("summary"),
    summary_msg_count: integer("summary_msg_count").notNull().default(0),
    last_intent: text("last_intent"),
  },
  (t) => [index("conversations_user_recent_idx").on(t.user_id, t.last_message_at)],
);

// ---------- messages ----------
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
    tokens_used: integer("tokens_used").default(0),
    created_at: tsNow("created_at"),
  },
  (t) => [index("messages_conv_time_idx").on(t.conversation_id, t.created_at)],
);

// ---------- divination_records ----------
export const divinationRecords = sqliteTable("divination_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  message_id: text("message_id")
    .notNull()
    .unique()
    .references(() => messages.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["qianwen", "dream", "bazi", "meihua"] }).notNull(),
  input: text("input").notNull(), // JSON
  result: text("result").notNull(), // JSON
  ai_reading: text("ai_reading"),
  created_at: tsNow("created_at"),
});

// ---------- prompts ----------
export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull(),
    version: integer("version").notNull().default(1),
    system_prompt: text("system_prompt").notNull(),
    user_prompt_tpl: text("user_prompt_tpl").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    created_at: tsNow("created_at"),
  },
  (t) => [
    uniqueIndex("prompts_key_version_uq").on(t.key, t.version),
    index("prompts_key_active_idx").on(t.key, t.active),
  ],
);

// ---------- divination_slips（P2 seed） ----------
export const divinationSlips = sqliteTable("divination_slips", {
  number: integer("number").primaryKey(),
  level: text("level", { enum: ["上上", "上吉", "吉", "平", "渐顺", "慎行"] }).notNull(),
  title: text("title").notNull(),
  poem: text("poem").notNull(),
  readings: text("readings").notNull(), // JSON
  image_url: text("image_url"),
});

// ---------- hexagrams（P2 seed） ----------
const TRIGRAMS = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"] as const;
const WUXING = ["金", "木", "水", "火", "土"] as const;

export const hexagrams = sqliteTable("hexagrams", {
  number: integer("number").primaryKey(),
  name: text("name").notNull(),
  upper_trigram: text("upper_trigram", { enum: TRIGRAMS }).notNull(),
  lower_trigram: text("lower_trigram", { enum: TRIGRAMS }).notNull(),
  upper_wuxing: text("upper_wuxing", { enum: WUXING }).notNull(),
  lower_wuxing: text("lower_wuxing", { enum: WUXING }).notNull(),
  judgment: text("judgment").notNull(),
  image: text("image").notNull(),
  lines: text("lines").notNull(), // JSON
});

// ---------- 类型 export ----------
export type Profile = typeof profiles.$inferSelect;
export type ProfileInsert = typeof profiles.$inferInsert;
export type BaziChart = typeof baziCharts.$inferSelect;
export type BaziChartInsert = typeof baziCharts.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
export type DivinationRecord = typeof divinationRecords.$inferSelect;

// 让 primaryKey 在编辑器里别报 "imported but not used"
void primaryKey;
