import { unlinkSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * V2.0 wipe + 重建 — 删除 sqlite 文件 + drizzle-kit push 一次性建表
 *
 * spec §2.1 设计原则：不写迁移脚本，新 schema 一次到位。
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
console.log("DB reset:", ABS);
