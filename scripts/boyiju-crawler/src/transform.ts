/**
 * 原始数据 → seed 格式转换
 *
 * 读取 output/gua64-raw.json，转换为 db/seed/hexagrams.ts 的 HexagramRow 格式
 * 输出 output/gua64-seed.ts
 *
 * 用法: npx tsx src/transform.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { GuaRawData } from "./parsers/gua64.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_FILE = join(__dirname, "output", "gua64-raw.json");
const SEED_FILE = join(__dirname, "output", "gua64-seed.ts");

/** 项目 hexagrams.ts 的 HexagramRow 格式 */
interface HexagramRow {
  number: number;
  name: string;
  upper_trigram: string;
  lower_trigram: string;
  upper_wuxing: string;
  lower_wuxing: string;
  judgment: string;
  image: string;
  lines: string; // JSON
}

/** 项目现有 hexagrams 数据（从 lib/meihua/hexagrams.ts 推导的上下卦/五行） */
interface ExistingHexagram {
  number: number;
  name: string;
  upper_trigram: string;
  lower_trigram: string;
  upper_wuxing: string;
  lower_wuxing: string;
}

/** 五行映射（八卦→五行） */
const WUXING_MAP: Record<string, string> = {
  乾: "金",
  兑: "金",
  离: "火",
  震: "木",
  巽: "木",
  坎: "水",
  艮: "土",
  坤: "土",
};

/**
 * 从项目 lib/meihua/hexagrams.ts 读取现有数据（上下卦/五行）
 * 这些是算法推导的，不能从卜易居覆盖
 *
 * 按卦名匹配，而非卦序号（因为不同数据源序号可能不同）
 */
function loadExistingHexagrams(): Map<string, ExistingHexagram> {
  const hexPath = join(__dirname, "..", "..", "..", "lib", "meihua", "hexagrams.ts");
  const content = readFileSync(hexPath, "utf-8");

  const map = new Map<string, ExistingHexagram>();

  // 解析 HEXAGRAM_TABLE 数组中的条目
  // 格式: { number: 1, name: "乾为天", upper: "乾", lower: "乾" }
  const entryRegex = /\{\s*number:\s*(\d+)\s*,\s*name:\s*"([^"]+)"\s*,\s*upper:\s*"([^"]+)"\s*,\s*lower:\s*"([^"]+)"\s*\}/g;
  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const name = match[2]; // 如 "乾为天"
    map.set(name, {
      number: parseInt(match[1], 10),
      name,
      upper_trigram: match[3],
      lower_trigram: match[4],
      upper_wuxing: WUXING_MAP[match[3]] || "",
      lower_wuxing: WUXING_MAP[match[4]] || "",
    });
  }

  return map;
}

function main() {
  console.log("=== 数据转换 ===\n");

  // 读取原始爬取数据
  const rawData: GuaRawData[] = JSON.parse(readFileSync(RAW_FILE, "utf-8"));
  console.log(`读取 ${rawData.length} 条原始数据`);

  const existing = loadExistingHexagrams();
  console.log(`读取 ${existing.size} 条现有卦数据（上下卦/五行）`);

  // 转换
  const seedRows: HexagramRow[] = rawData.map((raw) => {
    // 从 fullTitle 提取全名（如"乾为天"）
    // 格式: "周易第X卦 短名 全名 X上X下" 或 "周易第X卦\xa0短名\xa0全名 X上X下"
    const fullNameMatch = raw.fullTitle.match(/卦[\s\xa0]+\S+[\s\xa0]+(\S+)/);
    const fullName = fullNameMatch?.[1] ?? raw.name ?? "";

    // 用全名匹配 hexagrams.ts 中的数据
    let ex = existing.get(fullName);
    if (!ex) {
      // 尝试用短名模糊匹配
      for (const [key, val] of existing) {
        if (key.includes(raw.name) || raw.name.includes(val.name.replace(/为.*/, ""))) {
          ex = val;
          break;
        }
      }
    }
    if (!ex) {
      console.warn(`  警告：第${raw.number}卦 ${raw.name} (${raw.fullTitle}) fullName=${fullName} 无现有数据`);
    }

    // 卦辞：优先用卜易居原文，fallback 到现有
    const judgment = raw.gua_ci || "（卦辞待补）";

    // 大象传：用卜易居解文中的《象》曰
    const image = raw.da_xiang || raw.daXiang || "（象辞待补）";

    // 爻辞：卜易居的 6 爻，确保 6 条
    let yao_ci = raw.yao_ci;
    if (yao_ci.length < 6) {
      // 补齐到 6 条
      while (yao_ci.length < 6) {
        yao_ci.push(`第${yao_ci.length + 1}爻待补`);
      }
    }
    if (yao_ci.length > 6) {
      yao_ci = yao_ci.slice(0, 6);
    }

    return {
      number: ex?.number ?? raw.number,
      name: ex?.name || raw.fullTitle || raw.name,
      upper_trigram: ex?.upper_trigram || "",
      lower_trigram: ex?.lower_trigram || "",
      upper_wuxing: ex?.upper_wuxing || WUXING_MAP[ex?.upper_trigram ?? ""] || "",
      lower_wuxing: ex?.lower_wuxing || WUXING_MAP[ex?.lower_trigram ?? ""] || "",
      judgment,
      image,
      lines: JSON.stringify(yao_ci, null, 0),
    };
  });

  // 生成 TypeScript seed 文件
  const tsContent = generateSeedFile(seedRows);
  writeFileSync(SEED_FILE, tsContent, "utf-8");
  console.log(`\n写入 ${SEED_FILE}`);

  // 校验报告
  const missingImage = seedRows.filter((r) => r.image.includes("待补"));
  const missingLines = seedRows.filter((r) => r.lines.includes("待补"));
  console.log(`\n=== 校验 ===`);
  console.log(`  总计: ${seedRows.length} 卦`);
  console.log(`  缺大象传: ${missingImage.length}`);
  console.log(`  缺爻辞: ${missingLines.length}`);

  // 输出补全前后对比
  console.log(`\n=== 前后对比（前 3 卦）===`);
  seedRows.slice(0, 3).forEach((r) => {
    console.log(`\n  第${r.number}卦 ${r.name}:`);
    console.log(`    judgment: ${r.judgment.substring(0, 40)}...`);
    console.log(`    image: ${r.image.substring(0, 40)}...`);
    console.log(`    lines: ${r.lines.substring(0, 60)}...`);
  });

  console.log("\n完成！将 output/gua64-seed.ts 中的数据合并回 db/seed/hexagrams.ts");
}

function generateSeedFile(rows: HexagramRow[]): string {
  const entries = rows.map((r) => `  ${JSON.stringify(r)}`).join(",\n");

  return `// AUTO-GENERATED by scripts/boyiju-crawler/src/transform.ts
// 数据来源：卜易居 (buyiju.com) 周易六十四卦详解
// 仅供学习研究使用

export interface HexagramRow {
  number: number;
  name: string;
  upper_trigram: string;
  lower_trigram: string;
  upper_wuxing: string;
  lower_wuxing: string;
  judgment: string;
  image: string;
  lines: string; // JSON
}

export const HEXAGRAMS_BOYIJU: readonly HexagramRow[] = [
${entries}
];
`;
}

main();
