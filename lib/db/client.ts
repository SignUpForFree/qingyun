import "server-only";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { ensureSeeded } from "./seed";

/**
 * SQLite 单例 client + 启动时自动 migrate
 *
 * - DATABASE_URL=file:./dev.db （默认）→ sqlite 文件位于项目根
 * - DATABASE_URL=:memory: （vitest 用）→ 内存
 *
 * 自动 migrate：进程首次拿 client 时 idempotent 应用 db/migrations-sqlite/*.sql
 * （drizzle-kit generate 产物）。生产/dev 通用，避免单独 migrate 步骤。
 */

let cached: ReturnType<typeof create> | null = null;

function resolveSqlitePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (url === ":memory:") return ":memory:";
  if (url.startsWith("file:")) {
    const rel = url.slice("file:".length);
    return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  }
  return url; // 直接当文件路径
}

function create() {
  const dbPath = resolveSqlitePath();

  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  // SQLite 推荐设置：WAL 提高并发读 + foreign_keys 强制开
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // 启动 migrate（dev/prod 都跑；migration 已 apply 时是 no-op）
  const migrationsFolder = path.resolve(process.cwd(), "db/migrations-sqlite");
  if (fs.existsSync(migrationsFolder)) {
    try {
      migrate(db, { migrationsFolder });
    } catch (e) {
      console.error("drizzle migrate 失败", e);
      throw e;
    }
  } else {
    console.warn(
      "[db] db/migrations-sqlite 不存在 — 运行 `pnpm db:generate` 后再 `pnpm db:migrate`",
    );
  }

  return { db, sqlite };
}

export function getDb() {
  if (!cached) {
    cached = create();
    try {
      ensureSeeded(cached.db);
    } catch (e) {
      console.error("seed 失败 (可继续运行)", e);
    }
  }
  return cached.db;
}

export function closeDb() {
  if (cached) {
    cached.sqlite.close();
    cached = null;
  }
}
