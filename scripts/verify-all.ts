/**
 * 福小运全项目自动化验证 — 主入口
 *
 * 用法:
 *   npx tsx scripts/verify-all.ts              # 运行层1（纯函数）
 *   npx tsx scripts/verify-all.ts --layer=2    # 运行层2（API路由，需启动 dev server）
 *   npx tsx scripts/verify-all.ts --layer=all  # 运行全部
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { verifyBazi, type CheckResult } from "./verify-bazi";
import { verifyQianwen } from "./verify-qianwen";
import { verifyMeihua } from "./verify-meihua";
import { verifyFortune, verifyDream, verifyAIPrompts } from "./verify-fortune";
import { verifyApiRoutes } from "./verify-api-routes";

const args = process.argv.slice(2);
const layer = args.find((a) => a.startsWith("--layer="))?.split("=")[1] ?? "1";

async function main() {
  const allResults: CheckResult[] = [];
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsDir = join(__dirname, "..", "results");
  mkdirSync(resultsDir, { recursive: true });

  console.log("═══════════════════════════════════════");
  console.log("  福小运 全项目自动化验证");
  console.log(`  层级: ${layer}`);
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════\n");

  // ── 层1: 纯函数验证 ──
  if (layer === "1" || layer === "all") {
    console.log("── 层1: 纯函数/计算引擎验证 ──\n");

    console.log("▶ 八字规则引擎...");
    const baziResults = verifyBazi();
    allResults.push(...baziResults);
    printSummary("八字", baziResults);

    console.log("\n▶ 签文系统...");
    const qianwenResults = verifyQianwen();
    allResults.push(...qianwenResults);
    printSummary("签文", qianwenResults);

    console.log("\n▶ 梅花易数...");
    const meihuaResults = verifyMeihua();
    allResults.push(...meihuaResults);
    printSummary("梅花", meihuaResults);

    console.log("\n▶ 每日运势...");
    const fortuneResults = verifyFortune();
    allResults.push(...fortuneResults);
    printSummary("运势", fortuneResults);

    console.log("\n▶ 解梦输入...");
    const dreamResults = verifyDream();
    allResults.push(...dreamResults);
    printSummary("解梦", dreamResults);

    console.log("\n▶ AI Prompt...");
    const aiResults = verifyAIPrompts();
    allResults.push(...aiResults);
    printSummary("AI Prompt", aiResults);
  }

  // ── 层2: API路由验证 ──
  if (layer === "2" || layer === "all") {
    console.log("\n── 层2: API路由验证 ──");
    console.log("（需先启动 dev server: pnpm dev）\n");

    const apiResults = await verifyApiRoutes();
    allResults.push(...apiResults);
    printSummary("API路由", apiResults);
  }

  // ── 汇总 ──
  const pass = allResults.filter((r) => r.verdict === "PASS").length;
  const fail = allResults.filter((r) => r.verdict === "FAIL").length;
  const warnCount = allResults.filter((r) => r.verdict === "WARN").length;
  const total = allResults.length;

  console.log("\n═══════════════════════════════════════");
  console.log(`  总计: ${pass} PASS / ${fail} FAIL / ${warnCount} WARN / ${total} 项`);
  console.log("═══════════════════════════════════════\n");

  // ── FAIL 详情 ──
  const failedItems = allResults.filter((r) => r.verdict === "FAIL");
  if (failedItems.length > 0) {
    console.log("── FAIL 详情 ──");
    for (const r of failedItems) {
      console.log(`  FAIL [${r.section}] ${r.id}: ${r.detail}`);
    }
    console.log();
  }

  // ── 落盘 JSON ──
  const jsonPath = join(resultsDir, `verify-${ts}.json`);
  writeFileSync(jsonPath, JSON.stringify({ timestamp: ts, layer, summary: { pass, fail, warn: warnCount, total }, results: allResults }, null, 2), "utf-8");
  console.log(`JSON 报告: ${jsonPath}`);

  // ── 落盘 TXT ──
  const lines: string[] = [];
  lines.push(`福小运全项目自动化验证报告`);
  lines.push(`时间: ${new Date().toISOString()}`);
  lines.push(`层级: ${layer}`);
  lines.push(`总计: ${pass} PASS / ${fail} FAIL / ${warnCount} WARN / ${total} 项`);
  lines.push("");
  for (const r of allResults) {
    lines.push(`${r.verdict.padEnd(4)} [${r.section}] ${r.id}: ${r.detail}`);
  }
  const txtPath = join(resultsDir, `verify-${ts}.txt`);
  writeFileSync(txtPath, lines.join("\n"), "utf-8");
  console.log(`TXT 报告: ${txtPath}`);

  // exit code
  process.exit(fail > 0 ? 1 : 0);
}

function printSummary(name: string, results: CheckResult[]) {
  const p = results.filter((r) => r.verdict === "PASS").length;
  const f = results.filter((r) => r.verdict === "FAIL").length;
  const w = results.filter((r) => r.verdict === "WARN").length;
  console.log(`  ${name}: ${p} PASS / ${f} FAIL / ${w} WARN`);
  for (const r of results.filter((r) => r.verdict !== "PASS")) {
    console.log(`    ${r.verdict} ${r.id}: ${r.detail}`);
  }
}

main().catch((e) => {
  console.error("验证脚本异常:", e);
  process.exit(2);
});