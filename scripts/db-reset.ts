import { unlinkSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

/**
 * V2.0 wipe + 重建 — 删除 sqlite 文件 + drizzle-kit push 一次性建表 + 注入 FTS5
 *
 * spec §2.1 设计原则：不写迁移脚本，新 schema 一次到位。
 *
 * 流程:
 *   1. 删除 sqlite 文件
 *   2. drizzle-kit push（建 14 张表）
 *   3. 应用 db/migrations/0002_fts5.sql（FTS5 虚表 + 3 个同步 trigger）
 *      drizzle-orm 0.45 不能在 DSL 里表达 FTS5 虚表/trigger，所以走 raw SQL。
 *
 * 安全：NODE_ENV=production 时直接拒绝（避免误操作生产数据）。
 *       想强制覆盖 prod，设 ALLOW_PROD_DB_RESET=1。
 */

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_DB_RESET !== "1") {
  console.error("FAIL: db-reset 拒绝在 NODE_ENV=production 下运行；设 ALLOW_PROD_DB_RESET=1 强制。");
  process.exit(1);
}

const DB = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const ABS = path.isAbsolute(DB) ? DB : path.resolve(process.cwd(), DB);

if (existsSync(ABS)) {
  unlinkSync(ABS);
  for (const ext of ["-wal", "-shm"]) {
    const f = ABS + ext;
    if (existsSync(f)) unlinkSync(f);
  }
}

execSync("pnpm drizzle-kit push", { stdio: "inherit" });

const sqlite = new Database(ABS);

// 注入 FTS5（drizzle 之后跑，否则 messages 表还不存在）
const fts5Sql = readFileSync(
  path.join(process.cwd(), "db/migrations/0002_fts5.sql"),
  "utf8",
);
sqlite.exec(fts5Sql);

// 把 db/migrations-sqlite 里所有 drizzle migration 标为"已应用"
// 原因：db:reset 用 drizzle-kit push（不写 __drizzle_migrations 表），
//       但 client.ts 启动时跑 migrate() — 没有 journal entry 会让它重跑
//       CREATE TABLE 撞到已存在的表。这里手动 seal journal，让 migrate() 变 no-op。
sealDrizzleJournal(sqlite);

sqlite.close();

console.log("DB reset:", ABS);
console.log("FTS5 applied: messages_fts + 3 triggers (ai/ad/au)");

function sealDrizzleJournal(db: Database.Database): void {
  const migrationsFolder = path.join(process.cwd(), "db/migrations-sqlite");
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!existsSync(journalPath)) return;

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ tag: string; when: number }>;
  };

  db.exec(`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash text NOT NULL,
    created_at numeric
  )`);

  const insert = db.prepare(
    `INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)`,
  );
  for (const entry of journal.entries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!existsSync(sqlPath)) continue;
    const sqlText = readFileSync(sqlPath, "utf8");
    const hash = crypto.createHash("sha256").update(sqlText).digest("hex");
    insert.run(hash, entry.when);
  }
}
