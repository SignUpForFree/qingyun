/**
 * DataAccess — 仓储抽象层（Repository Pattern）
 *
 * 设计目标：
 *   - 业务代码 import `dataAccess`，不直接 import drizzle / better-sqlite3
 *   - 当前实现：SQLite（lib/db/data-access-sqlite.ts）
 *   - 未来切 Postgres：写一个 PgDataAccess，env DATABASE_KIND=postgres，零业务改动
 *
 * 范围（本次最小实现）：
 *   - MessageRepo：高频 chat / divination 写入 + 读取近 K 条
 *   - ProfileRepo：高频"用户档案"列表 / 创建 / 删除 / 切默认
 *
 * 其他表（fortunes / conversations / users / phoneBind / wechatBind）当前
 * 仍然分散在各自 repository / route 中，不强制立即收口。
 */
import type { Message, Profile } from "./schema";

// ---------------- ProfileRepo ----------------

export interface CreateProfileInput {
  nickname: string;
  avatar_url?: string;
  gender: "male" | "female" | "other";
  birth_date: string;
  birth_time: string;
  birth_calendar?: "solar" | "lunar";
  birth_is_leap_month?: boolean;
  birth_place: string;
  current_address?: string;
}

export type UpdateProfileInput = Partial<CreateProfileInput & { is_default: true }>;

export interface ProfileRepo {
  list(userId: string): Promise<Profile[]>;
  create(userId: string, input: CreateProfileInput): Promise<Profile>;
  update(userId: string, profileId: string, patch: UpdateProfileInput): Promise<Profile>;
  delete(userId: string, profileId: string): Promise<void>;
  /** 找当前用户的默认档；无则返回 null */
  findDefault(userId: string): Promise<Profile | null>;
}

// ---------------- MessageRepo ----------------

export type MessageIntent = "chat" | "divination" | "dream" | "bazi" | "meihua";

export interface InsertMessageInput {
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: MessageIntent | null;
  metadata?: string | null;
  tokens_used?: number;
  profile_id_used?: string | null;
}

export interface MessageRepo {
  insert(input: InsertMessageInput): Promise<Message>;
  /**
   * 读取会话最近 N 条消息（按 created_at DESC limit N，再 reverse 给调用方）
   * 用于 chat router / summarizer 拼 prompt。
   */
  recent(conversationId: string, limit: number): Promise<Message[]>;
  /**
   * 统计某会话内"用户角色"消息数；rate-limit fallback 用。
   */
  countUserSince(
    conversationId: string,
    sinceIso: string,
  ): Promise<number>;
}

export interface DataAccess {
  profiles: ProfileRepo;
  messages: MessageRepo;
}
