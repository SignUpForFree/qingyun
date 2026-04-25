/**
 * Supabase 数据库类型
 *
 * 真正的 Database 类型由 `pnpm dlx supabase gen types typescript --project-id <ref>` 生成。
 * P1 阶段先放最小占位，等用户完成 supabase 注册 + db push 后用脚本覆盖。
 *
 * 升级路径（W2 D1 用户填好 .env.local 后）：
 *   SUPABASE_PROJECT_REF=<ref> ./scripts/gen-types.sh
 *
 * 注：Insert/Update 不用 self-reference + Omit 套娃 —— Supabase 客户端类型推断
 * 在嵌套时容易得到 never。直接展开字段的写法更稳。
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface ProfileRow {
  id: string;
  user_id: string;
  nickname: string | null;
  gender: "male" | "female" | null;
  birth_time: string | null;
  calendar_type: "solar" | "lunar" | null;
  birth_province: string | null;
  birth_city: string | null;
  birth_district: string | null;
  birth_longitude: number | null;
  birth_latitude: number | null;
  current_location: Json | null;
  avatar_url: string | null;
  is_default: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ProfileInsert {
  id?: string;
  user_id: string;
  nickname?: string | null;
  gender?: "male" | "female" | null;
  birth_time?: string | null;
  calendar_type?: "solar" | "lunar" | null;
  birth_province?: string | null;
  birth_city?: string | null;
  birth_district?: string | null;
  birth_longitude?: number | null;
  birth_latitude?: number | null;
  current_location?: Json | null;
  avatar_url?: string | null;
  is_default?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

interface BaziChartRow {
  id: string;
  profile_id: string;
  pillars: Json;
  five_elements: Json;
  day_master: string;
  ten_gods: Json;
  favorable_gods: Json | null;
  luck_pillars: Json | null;
  solar_true_time: string;
  raw: Json | null;
  created_at: string;
}

interface BaziChartInsert {
  id?: string;
  profile_id: string;
  pillars: Json;
  five_elements: Json;
  day_master: string;
  ten_gods: Json;
  favorable_gods?: Json | null;
  luck_pillars?: Json | null;
  solar_true_time: string;
  raw?: Json | null;
  created_at?: string;
}

interface FortuneRow {
  id: string;
  profile_id: string;
  fortune_date: string;
  score_overall: number | null;
  scores: Json | null;
  one_liner: string | null;
  readings: Json | null;
  attributes: Json | null;
  model: string | null;
  tokens_used: number | null;
  created_at: string;
}

interface FortuneInsert {
  id?: string;
  profile_id: string;
  fortune_date: string;
  score_overall?: number | null;
  scores?: Json | null;
  one_liner?: string | null;
  readings?: Json | null;
  attributes?: Json | null;
  model?: string | null;
  tokens_used?: number | null;
  created_at?: string;
}

interface ConversationRow {
  id: string;
  user_id: string;
  profile_id: string | null;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface ConversationInsert {
  id?: string;
  user_id: string;
  profile_id?: string | null;
  title?: string | null;
  last_message_at?: string | null;
  created_at?: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent: "chat" | "divination" | "dream" | "bazi" | "meihua" | null;
  metadata: Json | null;
  tokens_used: number | null;
  created_at: string;
}

interface MessageInsert {
  id?: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: "chat" | "divination" | "dream" | "bazi" | "meihua" | null;
  metadata?: Json | null;
  tokens_used?: number | null;
  created_at?: string;
}

interface DivinationRecordRow {
  id: string;
  message_id: string;
  type: "qianwen" | "dream" | "bazi" | "meihua";
  input: Json;
  result: Json;
  ai_reading: string | null;
  created_at: string;
}

interface DivinationRecordInsert {
  id?: string;
  message_id: string;
  type: "qianwen" | "dream" | "bazi" | "meihua";
  input: Json;
  result: Json;
  ai_reading?: string | null;
  created_at?: string;
}

interface PromptRow {
  id: string;
  key: string;
  version: number;
  system_prompt: string;
  user_prompt_tpl: string;
  active: boolean;
  created_at: string;
}

interface PromptInsert {
  id?: string;
  key: string;
  version?: number;
  system_prompt: string;
  user_prompt_tpl: string;
  active?: boolean;
  created_at?: string;
}

interface DivinationSlipRow {
  number: number;
  level: "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";
  title: string;
  poem: string;
  readings: Json;
  image_url: string | null;
}

interface HexagramRow {
  number: number;
  name: string;
  upper_trigram: string;
  lower_trigram: string;
  upper_wuxing: string;
  lower_wuxing: string;
  judgment: string;
  image: string;
  lines: Json;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
      };
      bazi_charts: {
        Row: BaziChartRow;
        Insert: BaziChartInsert;
        Update: Partial<BaziChartInsert>;
      };
      fortunes: {
        Row: FortuneRow;
        Insert: FortuneInsert;
        Update: Partial<FortuneInsert>;
      };
      conversations: {
        Row: ConversationRow;
        Insert: ConversationInsert;
        Update: Partial<ConversationInsert>;
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: Partial<MessageInsert>;
      };
      divination_records: {
        Row: DivinationRecordRow;
        Insert: DivinationRecordInsert;
        Update: Partial<DivinationRecordInsert>;
      };
      prompts: {
        Row: PromptRow;
        Insert: PromptInsert;
        Update: Partial<PromptInsert>;
      };
      divination_slips: {
        Row: DivinationSlipRow;
        Insert: DivinationSlipRow;
        Update: Partial<DivinationSlipRow>;
      };
      hexagrams: {
        Row: HexagramRow;
        Insert: HexagramRow;
        Update: Partial<HexagramRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
