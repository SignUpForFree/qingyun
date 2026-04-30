import { unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * dev DB 重置 — rm 文件 → 新建 sqlite → drizzle migrate（与运行时 getDb() 同路径）
 *
 * 重置后 schema 与 lib/db/schema.ts 完全一致：
 *   - 走 db/migrations-sqlite/ 里所有 .sql（当前是 0000_init.sql 一把建完）
 *   - FTS5 虚表 + sync trigger 已合进 0000_init.sql，不再单独注入
 *
 * 安全：NODE_ENV=production 直接拒；强制覆盖设 ALLOW_PROD_DB_RESET=1。
 */

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_DB_RESET !== "1") {
  console.error("FAIL: db-reset 拒绝在 NODE_ENV=production 下运行；设 ALLOW_PROD_DB_RESET=1 强制。");
  process.exit(1);
}

const DB = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const ABS = path.isAbsolute(DB) ? DB : path.resolve(process.cwd(), DB);

for (const ext of ["", "-wal", "-shm"]) {
  const f = ABS + ext;
  if (existsSync(f)) unlinkSync(f);
}

const sqlite = new Database(ABS);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: path.resolve(process.cwd(), "db/migrations-sqlite") });
sqlite.close();

console.log("DB reset:", ABS);
