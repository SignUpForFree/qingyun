/**
 * 签文系统验证
 */
import { SLIPS_V2, type SlipLevel, type SlipReadings } from "../db/seed/slips-v2";
import { SLIPS_MAX, pickSlip, drawSlip, getSlip, BASE_WEIGHTS, DIVINATION_DIMS, adjustWeights, type DivinationDim } from "../lib/divination/slips";
import { SLIP_LEVELS } from "../lib/divination/slip-level";
import type { CheckResult } from "./verify-bazi";

function check(id: string, section: string, condition: boolean, passMsg: string, failMsg: string): CheckResult {
  return { id, section, verdict: condition ? "PASS" : "FAIL", detail: condition ? passMsg : failMsg };
}

function warn(id: string, section: string, msg: string): CheckResult {
  return { id, section, verdict: "WARN", detail: msg };
}

export function verifyQianwen(): CheckResult[] {
  const results: CheckResult[] = [];

  // 100签数据完整
  results.push(check(
    "qw-100-slips",
    "签文数据",
    SLIPS_V2.length === 100,
    `签文数量=${SLIPS_V2.length}`,
    `签文数量=${SLIPS_V2.length} ≠ 100`,
  ));

  // 签号1-100唯一
  const numbers = SLIPS_V2.map((s) => s.number);
  const uniqueNumbers = new Set(numbers);
  results.push(check(
    "qw-unique-numbers",
    "签文数据",
    uniqueNumbers.size === 100 && numbers.every((n) => n >= 1 && n <= 100),
    `签号1-100唯一`,
    `签号不唯一或不在1-100范围`,
  ));

  // 签等级6级
  const levels = new Set(SLIPS_V2.map((s) => s.level));
  const expectedLevels: SlipLevel[] = ["上上", "上吉", "吉", "平", "渐顺", "慎行"];
  results.push(check(
    "qw-6-levels",
    "签文数据",
    expectedLevels.every((l) => levels.has(l)) && levels.size === 6,
    `签等级=${[...levels].join(",")}`,
    `签等级不完整, 有=${[...levels].join(",")}`,
  ));

  // 签诗行数（>= 1 即可，短签诗常见于平/渐顺签）
  let poemLinesOk = true;
  const shortPoems: number[] = [];
  for (const s of SLIPS_V2) {
    const lines = s.poem.split(/[\n，。！？]+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 1 || lines.length > 8) { poemLinesOk = false; break; }
    if (lines.length < 2) shortPoems.push(s.number);
  }
  results.push(check(
    "qw-poem-lines",
    "签文数据",
    poemLinesOk,
    `签诗行数合理`,
    `有签诗行数异常`,
  ));
  if (shortPoems.length > 0) {
    results.push(warn("qw-short-poems", "签文数据", `${shortPoems.length}签诗仅1行: #${shortPoems.join(",")}`));
  }

  // 签分类6类
  const dims = new Set(DIVINATION_DIMS);
  results.push(check(
    "qw-6-dims",
    "签文数据",
    dims.size === 6,
    `签分类=${DIVINATION_DIMS.join(",")}`,
    `签分类数量=${dims.size} ≠ 6`,
  ));

  // 每签有6类解读
  let readingsOk = true;
  const dimSet = new Set<string>(DIVINATION_DIMS);
  for (const s of SLIPS_V2) {
    const readingKeys = Object.keys(s.readings);
    if (!DIVINATION_DIMS.every((d) => readingKeys.includes(d))) { readingsOk = false; break; }
  }
  results.push(check(
    "qw-6-readings",
    "签文数据",
    readingsOk,
    `每签有6类解读`,
    `有签缺少解读类别`,
  ));

  // 权重分布
  const levelDist: Record<string, number> = {};
  for (const s of SLIPS_V2) { levelDist[s.level] = (levelDist[s.level] || 0) + 1; }
  // 上上1-10, 上吉11-30, 吉31-55, 平56-80, 渐顺81-95, 慎行96-100
  results.push(check(
    "qw-level-dist",
    "签文数据",
    levelDist["上上"] === 10 && levelDist["上吉"] === 20 && levelDist["吉"] === 25 && levelDist["平"] === 25 && levelDist["渐顺"] === 15 && levelDist["慎行"] === 5,
    `签等级分布: ${JSON.stringify(levelDist)}`,
    `签等级分布不匹配: ${JSON.stringify(levelDist)}`,
  ));

  // 抽签确定性
  const seed = "test-seed";
  const r1 = pickSlip({ seed });
  const r2 = pickSlip({ seed });
  results.push(check(
    "qw-deterministic",
    "签文抽取",
    r1.number === r2.number,
    `同seed抽签确定: number=${r1.number}`,
    `同seed抽签不一致: ${r1.number} ≠ ${r2.number}`,
  ));

  // drawSlip 完整
  try {
    const drawn = drawSlip({ profileId: "p1", date: "2026-05-20", question: "测试", category: "综合运势" });
    results.push(check(
      "qw-draw-slip",
      "签文抽取",
      drawn.slipNumber >= 1 && drawn.slipNumber <= 100 && drawn.dimensionReading.length > 0,
      `drawSlip成功: #${drawn.slipNumber} "${drawn.slip.title}" dimensionReading长度=${drawn.dimensionReading.length}`,
      `drawSlip异常`,
    ));
  } catch (e) {
    results.push(check("qw-draw-slip", "签文抽取", false, "", `drawSlip异常: ${(e as Error).message}`));
  }

  // getSlip 查询
  for (let i = 1; i <= 100; i++) {
    try {
      const slip = getSlip(i);
      if (!slip.title || !slip.level || !slip.poem) {
        results.push(check(`qw-get-slip-${i}`, "签文数据", false, "", `签#${i}数据不完整`));
        break;
      }
    } catch (e) {
      results.push(check(`qw-get-slip-${i}`, "签文数据", false, "", `签#${i}查询异常: ${(e as Error).message}`));
      break;
    }
    if (i === 100) {
      results.push(check("qw-get-all-slips", "签文数据", true, `1-100签全部可查询且数据完整`, ""));
    }
  }

  // 权重微调
  const baseW = { ...BASE_WEIGHTS };
  const weakYongShen = { gejuType: "身弱" as const, yongShen: "金" as const, jiShen: "火" as const, strength: 25, reason: "test" };
  const strongYongShen = { gejuType: "身强" as const, yongShen: "火" as const, jiShen: "金" as const, strength: 75, reason: "test" };
  const adjustedWeak = adjustWeights(baseW, weakYongShen);
  const adjustedStrong = adjustWeights(baseW, strongYongShen);
  results.push(check(
    "qw-weight-adjust-weak",
    "签文权重",
    adjustedWeak.慎行 === baseW.慎行 + 5,
    `身弱慎行权重${adjustedWeak.慎行} = 基础${baseW.慎行}+5`,
    `身弱慎行权重${adjustedWeak.慎行} ≠ ${baseW.慎行}+5`,
  ));
  results.push(check(
    "qw-weight-adjust-strong",
    "签文权重",
    adjustedStrong.上吉 === baseW.上吉 + 3 && adjustedStrong.吉 === baseW.吉 + 3,
    `身强上吉+吉权重+3`,
    `身强权重调整不正确`,
  ));

  return results;
}

if (require.main === module || process.argv[1]?.includes("verify-qianwen")) {
  const results = verifyQianwen();
  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  console.log(`\n签文验证: ${pass} PASS / ${fail} FAIL / ${results.length} 总计`);
  for (const r of results.filter((r) => r.verdict !== "PASS")) {
    console.log(`  ${r.verdict} [${r.section}] ${r.id}: ${r.detail}`);
  }
}