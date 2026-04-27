import { z } from "zod";

/**
 * V2.0 ENV schema（spec §7.4）
 *
 * 启动时一次性校验，缺关键值立刻 throw（防御 #7：.env.prod 易丢 AI_GATEWAY_API_KEY）。
 *
 * Cookie SameSite 强制 lax/strict，禁 none（防御 #12：微信内置浏览器 SameSite=None 随机失败）。
 * AI_TIMEOUT_MS 最低 60000（防御 #2：30s 太紧八字/梅花会超时）。
 *
 * M5 接 Sentry 时 SENTRY_DSN 才必须；M0-M4 可选。
 */
export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL required"),

  // AI Gateway (V1.0 已配，V2.0 保留)
  AI_GATEWAY_BASE_URL: z.string().url(),
  AI_GATEWAY_API_KEY: z.string().min(1),
  AI_GATEWAY_MODEL: z.string().min(1),
  AI_TIMEOUT_MS: z.coerce.number().int().min(60_000).default(60_000),

  // 备用 AI 网关（M5.17 接入，M0-M4 optional）
  AI_GATEWAY_BACKUP_BASE_URL: z.string().url().optional(),
  AI_GATEWAY_BACKUP_API_KEY: z.string().optional(),
  AI_GATEWAY_BACKUP_MODEL: z.string().optional(),

  // WeChat 服务号（M1 起必填）
  WECHAT_APPID: z.string().min(1),
  WECHAT_APPSECRET: z.string().min(1),
  WECHAT_STATE_SECRET: z.string().min(40, "WECHAT_STATE_SECRET must be ≥40 chars (base64-32-bytes)"),
  WECHAT_AES_KEY: z.string().min(40, "WECHAT_AES_KEY must be ≥40 chars (base64-32-bytes)"),
  WECHAT_TPL_DAILY_FORTUNE: z.string().min(1),
  WECHAT_TPL_REPORT_READY: z.string().min(1),
  WECHAT_OA_REDIRECT_URI: z.string().url(),

  // App
  PUBLIC_BASE_URL: z.string().url(),
  COOKIE_SECURE: z.enum(["true", "false"]).default("true"),
  COOKIE_SAMESITE: z.enum(["lax", "strict"]).default("lax"), // 不允许 none，防御 #12
  SESSION_SECRET: z.string().min(64, "SESSION_SECRET must be ≥64 chars (base64-64-bytes)"),

  // Rate Limit (per user per hour，spec §5.10)
  RATE_LIMIT_PER_HOUR_CHAT: z.coerce.number().int().default(30),
  RATE_LIMIT_PER_HOUR_BAZI: z.coerce.number().int().default(5),
  RATE_LIMIT_PER_HOUR_MEIHUA: z.coerce.number().int().default(5),
  RATE_LIMIT_PER_HOUR_DIVINATION: z.coerce.number().int().default(10),
  RATE_LIMIT_PER_HOUR_DREAM: z.coerce.number().int().default(10),

  // Cron (spec §5.7)
  CRON_DAILY_FORTUNE: z.string().default("30 0 * * *"),
  CRON_WEEKLY_FORTUNE: z.string().default("0 1 * * 1"),
  CRON_MONTHLY_FORTUNE: z.string().default("30 1 1 * *"),
  CRON_TZ: z.string().default("Asia/Shanghai"),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * 启动时调用一次。缺关键值立即 throw。
 *
 * 测试场景下传入显式 process.env 子集即可走 schema。
 */
export function getEnv(input: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const r = envSchema.safeParse(input);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`ENV schema fail:\n${issues}`);
  }
  cached = r.data;
  return cached;
}

/**
 * 仅供测试调用，重置缓存让下次 getEnv 重新校验。
 */
export function resetEnvCache(): void {
  cached = null;
}
