import { unlinkSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * V2.0 wipe + 重建 — 删除 sqlite 文件 + drizzle-kit push 一次性建表
 *
 * 注意：这是开发用 reset，生产环境请勿运行。
 * spec §2.1 设计原则：不写迁移脚本，新 schema 一次到位。
 */

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
// eslint-disable-next-line no-console
console.log("DB reset:", ABS);
