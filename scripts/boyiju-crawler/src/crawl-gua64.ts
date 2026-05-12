/**
 * 64 卦爬取主入口
 *
 * 用法: npx tsx src/crawl-gua64.ts
 *
 * 流程：
 * 1. 抓取列表页 → 解析 64 个详情页 URL
 * 2. 逐个抓取详情页（限速 1.5s）→ 解析结构化数据
 * 3. 写入 src/output/gua64-raw.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPage } from "./fetcher.js";
import { parseGuaListPage, parseGuaDetailPage, type GuaRawData } from "./parsers/gua64.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "gua64-raw.json");

const BASE_URL = "https://www.buyiju.com/zhouyi/";

async function main() {
  console.log("=== 卜易居 64 卦数据爬取 ===\n");

  // Step 1: 抓取列表页
  console.log("[1/3] 抓取列表页...");
  const listHtml = await fetchPage(BASE_URL);
  const guaLinks = parseGuaListPage(listHtml);
  console.log(`  找到 ${guaLinks.length} 个卦链接`);

  if (guaLinks.length === 0) {
    console.error("  未找到卦链接，列表页结构可能已变化！");
    process.exit(1);
  }

  // 确保有 1-64
  if (guaLinks.length < 64) {
    console.warn(`  警告：只找到 ${guaLinks.length}/64 卦，补全默认 URL`);
    for (let i = 1; i <= 64; i++) {
      if (!guaLinks.find((g) => g.number === i)) {
        guaLinks.push({
          number: i,
          name: "",
          url: `https://www.buyiju.com/zhouyi/yijing/64gua-${i}.html`,
        });
      }
    }
    guaLinks.sort((a, b) => a.number - b.number);
  }

  // Step 2: 逐个抓取详情页
  console.log("\n[2/3] 抓取详情页...");
  const results: GuaRawData[] = [];
  const errors: { number: number; error: string }[] = [];

  for (const link of guaLinks) {
    try {
      process.stdout.write(`  [${link.number}/64] ${link.name || `第${link.number}卦`}...`);
      const detailHtml = await fetchPage(link.url);
      const data = parseGuaDetailPage(detailHtml, link.number);
      results.push(data);

      const yaoCount = data.yao_ci.length;
      const hasDaXiang = data.da_xiang ? "✓" : "✗";
      console.log(` OK (爻辞:${yaoCount} 大象:${hasDaXiang})`);
    } catch (err) {
      const msg = (err as Error).message;
      errors.push({ number: link.number, error: msg });
      console.log(` FAIL: ${msg}`);
    }
  }

  // Step 3: 写入 JSON
  console.log("\n[3/3] 写入数据...");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(`  写入 ${OUTPUT_FILE} (${results.length} 条)`);

  // 校验报告
  console.log("\n=== 校验报告 ===");
  console.log(`  成功: ${results.length}/64`);
  console.log(`  失败: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\n  失败列表:");
    errors.forEach((e) => console.log(`    第${e.number}卦: ${e.error}`));
  }

  // 字段完整性
  const missingYao = results.filter((r) => r.yao_ci.length < 6);
  const missingDaXiang = results.filter((r) => !r.da_xiang);
  const missingGuaCi = results.filter((r) => !r.gua_ci);

  if (missingYao.length > 0) {
    console.log(`\n  爻辞不足6条: ${missingYao.map((r) => r.name).join(", ")}`);
  }
  if (missingDaXiang.length > 0) {
    console.log(`  缺大象传: ${missingDaXiang.map((r) => r.name).join(", ")}`);
  }
  if (missingGuaCi.length > 0) {
    console.log(`  缺卦辞: ${missingGuaCi.map((r) => r.name).join(", ")}`);
  }

  console.log("\n完成！");
}

main().catch((err) => {
  console.error("爬取失败:", err);
  process.exit(1);
});
