import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { slips } from "./schema";
import { SLIPS_V2 } from "@/db/seed/slips-v2";

type Db = BetterSQLite3Database<Record<string, unknown>>;

/**
 * 进程启动 idempotent seed（M3.1 接入 100 签）
 *
 * - 启动时 COUNT(*) FROM slips：0 时批量 INSERT 100 条；非 0 跳过
 * - level 直接使用 6 级（上上/上吉/吉/平/渐顺/慎行），无需映射
 * - category_readings 用 JSON 存（DB schema text）
 *
 * gua64 / shensha 等表后续 M3.16+ 再 seed。
 */
export function ensureSeeded(db: Db): void {
  try {
    seedSlips(db);
  } catch (e) {
    console.error("ensureSeeded: slips seed 失败", e);
  }
}

function seedSlips(db: Db): void {
  const [{ n }] = db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM slips`);
  if (n >= 100) return;

  const rows = SLIPS_V2.map((s) => ({
    number: s.number,
    level: s.level,
    title: s.title,
    poem: s.poem,
    default_reading: s.readings.综合运势,
    category_readings: JSON.stringify(s.readings),
  }));

  // 批量 insert with onConflict ignore（避免重启时唯一键碰撞）
  db.insert(slips).values(rows).onConflictDoNothing().run();
}
