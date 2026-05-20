/**
 * 梅花易数验证
 */
import { castByTime, castByNumbers } from "../lib/meihua/cast";
import { TRIGRAMS, TRIGRAM_NUMBER, TRIGRAM_WUXING, type Trigram, trigramByNumber } from "../lib/meihua/trigrams";
import { listHexagrams } from "../lib/meihua/hexagrams";
import { judgeTiYong } from "../lib/meihua/tiyong";
import type { CheckResult } from "./verify-bazi";

function check(id: string, section: string, condition: boolean, passMsg: string, failMsg: string): CheckResult {
  return { id, section, verdict: condition ? "PASS" : "FAIL", detail: condition ? passMsg : failMsg };
}

export function verifyMeihua(): CheckResult[] {
  const results: CheckResult[] = [];

  // 八卦数据
  results.push(check(
    "mh-8-trigrams",
    "八卦数据",
    TRIGRAMS.length === 8,
    `8经卦数量=${TRIGRAMS.length}`,
    `8经卦数量=${TRIGRAMS.length} ≠ 8`,
  ));

  // 每个经卦有五行映射
  const allHaveWuxing = TRIGRAMS.every((t) => TRIGRAM_WUXING[t] != null);
  results.push(check(
    "mh-trigram-wuxing",
    "八卦数据",
    allHaveWuxing,
    `每个经卦有五行映射`,
    `有经卦缺少五行映射`,
  ));

  // 每个经卦有数字映射
  const allHaveNumber = TRIGRAMS.every((t) => TRIGRAM_NUMBER[t] != null);
  results.push(check(
    "mh-trigram-number",
    "八卦数据",
    allHaveNumber,
    `每个经卦有数字映射`,
    `有经卦缺少数字映射`,
  ));

  // trigramByNumber roundtrip
  let roundtripOk = true;
  for (const t of TRIGRAMS) {
    const n = TRIGRAM_NUMBER[t];
    const back = trigramByNumber(n);
    if (back !== t) { roundtripOk = false; break; }
  }
  results.push(check(
    "mh-trigram-roundtrip",
    "八卦数据",
    roundtripOk,
    `trigramByNumber roundtrip 正确`,
    `trigramByNumber roundtrip 不一致`,
  ));

  // 64卦数据
  const hexagrams = listHexagrams();
  results.push(check(
    "mh-64-hexagrams",
    "64卦数据",
    hexagrams.length === 64,
    `64卦数量=${hexagrams.length}`,
    `64卦数量=${hexagrams.length} ≠ 64`,
  ));

  // 时间起卦
  try {
    const cast = castByTime(new Date("2026-05-20T10:30:00+08:00"));
    results.push(check(
      "mh-cast-by-time",
      "时间起卦",
      cast.upper != null && cast.lower != null && cast.dongYao >= 1 && cast.dongYao <= 6,
      `时间起卦: 上${cast.upper} 下${cast.lower} 动爻=${cast.dongYao}`,
      `时间起卦异常`,
    ));
  } catch (e) {
    results.push(check("mh-cast-by-time", "时间起卦", false, "", `异常: ${(e as Error).message}`));
  }

  // 数字起卦
  try {
    const cast = castByNumbers(3);
    results.push(check(
      "mh-cast-by-number-1",
      "数字起卦",
      cast.upper != null && cast.lower != null && cast.dongYao >= 1 && cast.dongYao <= 6 && cast.method === "number-1",
      `1数起卦: 上${cast.upper} 下${cast.lower} method=${cast.method}`,
      `1数起卦异常`,
    ));
  } catch (e) {
    results.push(check("mh-cast-by-number-1", "数字起卦", false, "", `异常: ${(e as Error).message}`));
  }

  try {
    const cast = castByNumbers(3, 5);
    results.push(check(
      "mh-cast-by-number-2",
      "数字起卦",
      cast.upper != null && cast.lower != null && cast.method === "number-2",
      `2数起卦成功`,
      `2数起卦异常`,
    ));
  } catch (e) {
    results.push(check("mh-cast-by-number-2", "数字起卦", false, "", `异常: ${(e as Error).message}`));
  }

  try {
    const cast = castByNumbers(3, 5, 2);
    results.push(check(
      "mh-cast-by-number-3",
      "数字起卦",
      cast.upper != null && cast.lower != null && cast.method === "number-3",
      `3数起卦成功`,
      `3数起卦异常`,
    ));
  } catch (e) {
    results.push(check("mh-cast-by-number-3", "数字起卦", false, "", `异常: ${(e as Error).message}`));
  }

  // 体用关系
  try {
    const cast = castByTime(new Date("2026-05-20T10:30:00+08:00"));
    const tiyong = judgeTiYong(cast);
    results.push(check(
      "mh-ti-yong",
      "体用关系",
      tiyong.ti != null && tiyong.yong != null,
      `体卦=${tiyong.ti} 用卦=${tiyong.yong} 关系=${tiyong.relation}`,
      `体用关系异常`,
    ));

    // 体用五行
    const tiWX = TRIGRAM_WUXING[tiyong.ti];
    const yongWX = TRIGRAM_WUXING[tiyong.yong];
    const validWuxing = new Set(["金", "木", "水", "火", "土"]);
    results.push(check(
      "mh-ti-yong-wuxing",
      "体用关系",
      validWuxing.has(tiWX) && validWuxing.has(yongWX),
      `体五行=${tiWX} 用五行=${yongWX}`,
      `体用五行不合法: ti=${tiWX} yong=${yongWX}`,
    ));
  } catch (e) {
    results.push(check("mh-ti-yong", "体用关系", false, "", `异常: ${(e as Error).message}`));
  }

  // 起卦确定性
  try {
    const c1 = castByNumbers(3, 5);
    const c2 = castByNumbers(3, 5);
    results.push(check(
      "mh-cast-deterministic",
      "起卦确定性",
      c1.upper === c2.upper && c1.lower === c2.lower && c1.dongYao === c2.dongYao,
      `同输入起卦确定`,
      `同输入起卦不一致`,
    ));
  } catch (e) {
    results.push(check("mh-cast-deterministic", "起卦确定性", false, "", `异常: ${(e as Error).message}`));
  }

  return results;
}

if (require.main === module || process.argv[1]?.includes("verify-meihua")) {
  const results = verifyMeihua();
  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  console.log(`\n梅花验证: ${pass} PASS / ${fail} FAIL / ${results.length} 总计`);
  for (const r of results.filter((r) => r.verdict !== "PASS")) {
    console.log(`  ${r.verdict} [${r.section}] ${r.id}: ${r.detail}`);
  }
}