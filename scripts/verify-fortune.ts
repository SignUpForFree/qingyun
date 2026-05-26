/**
 * 每日运势 + 解梦输入 验证
 */
import { dreamInputSchema, buildEmotionHint, DREAM_EMOTIONS } from "../lib/divination/dream-parser";
import { computeDaily7, DAILY_7_DIMS, type DimensionScores7, type Daily7Result } from "../lib/fortune/daily-7dim";
import { computeAttributes, type Attributes } from "../lib/fortune/attributes";
import { pickOneLiner7 } from "../lib/fortune/one-liner";
import { sanitizeAiOutput } from "../lib/ai/output-sanitizer";
import { guardTexts } from "../lib/safety/guard";
import { buildChartV2 } from "../lib/bazi/chart";
import { getDayPillar } from "../lib/bazi/today";
import type { CheckResult } from "./verify-bazi";

function check(id: string, section: string, condition: boolean, passMsg: string, failMsg: string): CheckResult {
  return { id, section, verdict: condition ? "PASS" : "FAIL", detail: condition ? passMsg : failMsg };
}

export function verifyFortune(): CheckResult[] {
  const results: CheckResult[] = [];

  // 运势7维度
  results.push(check(
    "ft-7-dims",
    "每日运势",
    DAILY_7_DIMS.length === 7,
    `7维度数量=${DAILY_7_DIMS.length}`,
    `7维度数量=${DAILY_7_DIMS.length} ≠ 7`,
  ));

  // 用真实命盘测试7维度评分
  const chart = buildChartV2({
    birthTime: new Date("1990-06-15T14:30:00+08:00"),
    longitude: 120.1551,
    latitude: 30.2741,
    gender: "male",
    calendarType: "solar",
  });
  const dayPillar = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));

  try {
    const result = computeDaily7({ chart, day: dayPillar });
    const dimKeys = Object.keys(result.scores) as (keyof DimensionScores7)[];
    results.push(check(
      "ft-7-scores",
      "每日运势",
      dimKeys.length === 7,
      `7维度评分keys=${dimKeys.length}`,
      `7维度评分keys=${dimKeys.length} ≠ 7`,
    ));

    // 每维度0-100分
    let scoreRangeOk = true;
    for (const k of dimKeys) {
      const v = result.scores[k];
      if (v < 0 || v > 100) { scoreRangeOk = false; break; }
    }
    results.push(check(
      "ft-score-range",
      "每日运势",
      scoreRangeOk,
      `7维度评分均在0-100范围`,
      `有维度评分超出0-100范围: ${JSON.stringify(result.scores)}`,
    ));

    // overall 合理范围 0-100
    results.push(check(
      "ft-overall-range",
      "每日运势",
      result.overall >= 0 && result.overall <= 100,
      `overall=${result.overall}`,
      `overall=${result.overall} 不在0-100范围`,
    ));

    // meta 有 dayPillar
    results.push(check(
      "ft-meta-daypillar",
      "每日运势",
      result.meta.dayPillar.gan != null && result.meta.dayPillar.zhi != null,
      `dayPillar=${result.meta.dayPillar.gan}${result.meta.dayPillar.zhi}`,
      `meta.dayPillar 缺失`,
    ));
  } catch (e) {
    results.push(check("ft-7-scores", "每日运势", false, "", `computeDaily7异常: ${(e as Error).message}`));
  }

  // lucky属性
  try {
    const attrs = computeAttributes(dayPillar);
    const attrKeys = Object.keys(attrs);
    results.push(check(
      "ft-attributes",
      "每日运势",
      attrKeys.length >= 6,
      `lucky属性=${attrKeys.length}个: ${attrKeys.join(",")}`,
      `lucky属性=${attrKeys.length} < 6`,
    ));
  } catch (e) {
    results.push(check("ft-attributes", "每日运势", false, "", `computeAttributes异常: ${(e as Error).message}`));
  }

  // one-liner
  try {
    const result = computeDaily7({ chart, day: dayPillar });
    const oneLiner = pickOneLiner7(result.scores, dayPillar.date);
    results.push(check(
      "ft-one-liner",
      "每日运势",
      oneLiner != null && oneLiner.length > 0,
      `one-liner="${oneLiner}"`,
      `one-liner为空`,
    ));
  } catch (e) {
    results.push(check("ft-one-liner", "每日运势", false, "", `pickOneLiner7异常: ${(e as Error).message}`));
  }

  return results;
}

export function verifyDream(): CheckResult[] {
  const results: CheckResult[] = [];

  // 文字长度校验 - 太短
  const tooShort = dreamInputSchema.safeParse({ dreamText: "太短了" });
  results.push(check(
    "dr-short-text",
    "解梦输入",
    !tooShort.success,
    `<10字拒绝: ${tooShort.success ? "意外通过" : "正确拒绝"}`,
    `<10字未拒绝`,
  ));

  // 正常长度
  const normal = dreamInputSchema.safeParse({ dreamText: "我梦见自己在一片广阔的草原上奔跑，远处有一座高山，山顶有光" });
  results.push(check(
    "dr-normal-text",
    "解梦输入",
    normal.success,
    `正常文本通过校验`,
    `正常文本未通过校验`,
  ));

  // emotion 校验
  const badEmotion = dreamInputSchema.safeParse({ dreamText: "我梦见自己在一片广阔的草原上奔跑，远处有一座高山", emotion: "兴奋" });
  results.push(check(
    "dr-bad-emotion",
    "解梦输入",
    !badEmotion.success,
    `非法emotion拒绝`,
    `非法emotion未拒绝`,
  ));

  const goodEmotion = dreamInputSchema.safeParse({ dreamText: "我梦见自己在一片广阔的草原上奔跑，远处有一座高山", emotion: "害怕" });
  results.push(check(
    "dr-good-emotion",
    "解梦输入",
    goodEmotion.success,
    `合法emotion通过`,
    `合法emotion未通过`,
  ));

  // buildEmotionHint
  for (const emo of DREAM_EMOTIONS) {
    const hint = buildEmotionHint(emo);
    results.push(check(
      `dr-hint-${emo}`,
      "解梦输入",
      hint.includes(emo),
      `emotionHint包含"${emo}"`,
      `emotionHint不包含"${emo}": ${hint}`,
    ));
  }

  // 5种emotion
  results.push(check(
    "dr-5-emotions",
    "解梦输入",
    DREAM_EMOTIONS.length === 5,
    `5种emotion: ${DREAM_EMOTIONS.join(",")}`,
    `emotion数量=${DREAM_EMOTIONS.length} ≠ 5`,
  ));

  return results;
}

// ── AI prompt 验证 ──

export function verifyAIPrompts(): CheckResult[] {
  const results: CheckResult[] = [];

  // output-sanitizer
  const dirty = "你命中有大凶之兆，命中注定要破财";
  const cleaned = sanitizeAiOutput(dirty, "divination");
  results.push(check(
    "ai-sanitizer",
    "AI Prompt",
    cleaned.hitCount > 0,
    `sanitizer命中${cleaned.hitCount}个禁词`,
    `sanitizer未命中禁词`,
  ));

  // safety guard
  const guardResult = guardTexts({ text: "正常文本" });
  results.push(check(
    "ai-safety-guard",
    "AI Prompt",
    guardResult === null,
    `正常文本通过安全检查`,
    `正常文本被误拦`,
  ));

  return results;
}

if (require.main === module || process.argv[1]?.includes("verify-fortune")) {
  const r1 = verifyFortune();
  const r2 = verifyDream();
  const r3 = verifyAIPrompts();
  const all = [...r1, ...r2, ...r3];
  const pass = all.filter((r) => r.verdict === "PASS").length;
  const fail = all.filter((r) => r.verdict === "FAIL").length;
  console.log(`\n运势+解梦+AI Prompt验证: ${pass} PASS / ${fail} FAIL / ${all.length} 总计`);
  for (const r of all.filter((r) => r.verdict !== "PASS")) {
    console.log(`  ${r.verdict} [${r.section}] ${r.id}: ${r.detail}`);
  }
}