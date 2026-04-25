/**
 * Supabase 数据库类型
 *
 * 真正的 Database 类型由 `pnpm dlx supabase gen types typescript --project-id <ref>` 生成。
 * P1 阶段先放最小占位，等用户完成 supabase 注册 + db push 后用脚本覆盖。
 *
 * 升级路径（W2 D1 用户填好 .env.local 后）：
 *   SUPABASE_PROJECT_REF=<ref> pnpm dlx supabase gen types typescript --project-id $SUPABASE_PROJECT_REF --schema public > types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        };
        Insert: Omit<
          Database["public"]["Tables"]["profiles"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      bazi_charts: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["bazi_charts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bazi_charts"]["Insert"]>;
      };
      fortunes: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["fortunes"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fortunes"]["Insert"]>;
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string | null;
          title: string | null;
          last_message_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["conversations"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          intent: "chat" | "divination" | "dream" | "bazi" | "meihua" | null;
          metadata: Json | null;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      divination_records: {
        Row: {
          id: string;
          message_id: string;
          type: "qianwen" | "dream" | "bazi" | "meihua";
          input: Json;
          result: Json;
          ai_reading: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["divination_records"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["divination_records"]["Insert"]>;
      };
      prompts: {
        Row: {
          id: string;
          key: string;
          version: number;
          system_prompt: string;
          user_prompt_tpl: string;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["prompts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prompts"]["Insert"]>;
      };
      divination_slips: {
        Row: {
          number: number;
          level: "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";
          title: string;
          poem: string;
          readings: Json;
          image_url: string | null;
        };
        Insert: Database["public"]["Tables"]["divination_slips"]["Row"];
        Update: Partial<Database["public"]["Tables"]["divination_slips"]["Insert"]>;
      };
      hexagrams: {
        Row: {
          number: number;
          name: string;
          upper_trigram: string;
          lower_trigram: string;
          upper_wuxing: string;
          lower_wuxing: string;
          judgment: string;
          image: string;
          lines: Json;
        };
        Insert: Database["public"]["Tables"]["hexagrams"]["Row"];
        Update: Partial<Database["public"]["Tables"]["hexagrams"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
