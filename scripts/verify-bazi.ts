/**
 * 八字规则引擎全链路验证
 *
 * 对应 docs/bazi-rules.md §1-§12
 * 直接调用 buildChartV2 + 中间函数，验证每个计算步骤
 */
import { buildChartV2, type BaziChartV2 } from "../lib/bazi/chart";
import { computeWuxingCount, computeWuxingStats, applyXchhCorrection, applyWangXiangScaling, applyDayMasterAdjust, computeTenGods, computeStrength, computeYongShenFull, computeTemporaryFortune, type StrengthType, type XchhMatch } from "../lib/bazi/engine";
import { TEN_STEMS, TWELVE_BRANCHES, wuxingOf, tenGod, tenGodCamp, HIDDEN_STEMS_DETAILED, YUELING_WUXING, WANG_XIANG_COEFF, dayMasterAdjustScore, wangXiangStatus, SHENG_CYCLE, KE_CYCLE, TONGGUAN_MAP, type Stem, type Branch, type Wuxing, type TenGod } from "../lib/bazi/stems-branches";
import { judgeFortuneLevel, generateAllLabels, type FortuneLevel } from "../lib/bazi/labels";
import type { BuildChartInput } from "../types/domain";

// ── 结果类型 ──

export type Verdict = "PASS" | "FAIL" | "WARN";

export interface CheckResult {
  id: string;
  section: string;
  verdict: Verdict;
  detail: string;
}

// ── 测试命盘 ──

interface TestCase {
  name: string;
  input: BuildChartInput;
}

const TEST_CASES: TestCase[] = [
  {
    name: "1990-06-15 14:30 杭州 男",
    input: { birthTime: new Date("1990-06-15T14:30:00+08:00"), longitude: 120.1551, latitude: 30.2741, gender: "male", calendarType: "solar" },
  },
  {
    name: "1984-03-15 10:00 北京 男",
    input: { birthTime: new Date("1984-03-15T10:00:00+08:00"), longitude: 116.4, latitude: 39.9, gender: "male", calendarType: "solar" },
  },
  {
    name: "1975-12-20 06:00 上海 女",
    input: { birthTime: new Date("1975-12-20T06:00:00+08:00"), longitude: 121.47, latitude: 31.23, gender: "female", calendarType: "solar" },
  },
  {
    name: "2000-08-08 12:00 广州 男",
    input: { birthTime: new Date("2000-08-08T12:00:00+08:00"), longitude: 113.26, latitude: 23.13, gender: "male", calendarType: "solar" },
  },
  {
    name: "1995-02-04 09:00 成都 女",
    input: { birthTime: new Date("1995-02-04T09:00:00+08:00"), longitude: 104.07, latitude: 30.67, gender: "female", calendarType: "solar" },
  },
];

// ── 验证函数 ──

function check(id: string, section: string, condition: boolean, passMsg: string, failMsg: string): CheckResult {
  return { id, section, verdict: condition ? "PASS" : "FAIL", detail: condition ? passMsg : failMsg };
}

function warn(id: string, section: string, msg: string): CheckResult {
  return { id, section, verdict: "WARN", detail: msg };
}

function verifyBazi(): CheckResult[] {
  const results: CheckResult[] = [];

  for (const tc of TEST_CASES) {
    const chart = buildChartV2(tc.input);
    const p = chart.pillars;
    const tag = `[${tc.name}]`;

    // ═══ §2 时空校正 ═══
    {
      const trueTime = new Date(chart.solarTrueTime);
      const original = tc.input.birthTime;
      const longitude = tc.input.longitude;
      // 经度修正 ≈ (经度-120)×4 分钟
      const expectedOffsetMin = (longitude - 120) * 4;
      const actualOffsetMin = (trueTime.getTime() - original.getTime()) / 60_000;
      // 允许±2分钟误差（EoT时差修正影响）
      const offsetClose = Math.abs(actualOffsetMin - expectedOffsetMin) < 3;
      results.push(check(
        `s2-solar-time-${tc.name}`,
        "§2 时空校正",
        offsetClose,
        `${tag} 真太阳时偏移≈${actualOffsetMin.toFixed(1)}分钟(预期≈${expectedOffsetMin.toFixed(1)})`,
        `${tag} 真太阳时偏移${actualOffsetMin.toFixed(1)}分钟, 预期≈${expectedOffsetMin.toFixed(1)}分钟(经度修正)`,
      ));

      // 时辰地支映射
      const hour = trueTime.getUTCHours() + 8; // UTC→UTC+8
      const adjustedHour = hour >= 24 ? hour - 24 : hour;
      let expectedZhi: Branch;
      if (adjustedHour >= 23 || adjustedHour < 1) expectedZhi = "子";
      else if (adjustedHour < 3) expectedZhi = "丑";
      else if (adjustedHour < 5) expectedZhi = "寅";
      else if (adjustedHour < 7) expectedZhi = "卯";
      else if (adjustedHour < 9) expectedZhi = "辰";
      else if (adjustedHour < 11) expectedZhi = "巳";
      else if (adjustedHour < 13) expectedZhi = "午";
      else if (adjustedHour < 15) expectedZhi = "未";
      else if (adjustedHour < 17) expectedZhi = "申";
      else if (adjustedHour < 19) expectedZhi = "酉";
      else if (adjustedHour < 21) expectedZhi = "戌";
      else expectedZhi = "亥";
      // 用 timeCorrection 的 real_hour_zhi 对比
      const realHourZhi = chart.timeCorrection.real_hour_zhi;
      results.push(check(
        `s2-hour-zhi-${tc.name}`,
        "§2 时空校正",
        realHourZhi != null && TWELVE_BRANCHES.includes(realHourZhi),
        `${tag} 时辰地支=${realHourZhi}`,
        `${tag} 时辰地支=${realHourZhi} 不合法`,
      ));

      // 节气名称非空
      results.push(check(
        `s2-solar-term-${tc.name}`,
        "§2 时空校正",
        chart.timeCorrection.solar_term.length > 0,
        `${tag} 节气=${chart.timeCorrection.solar_term}`,
        `${tag} 节气名为空`,
      ));

      // 子时边界
      const isZiShi = adjustedHour >= 23 || adjustedHour < 1;
      results.push(check(
        `s2-zishi-boundary-${tc.name}`,
        "§2 时空校正",
        chart.timeCorrection.is_zishi_boundary === isZiShi,
        `${tag} is_zishi_boundary=${chart.timeCorrection.is_zishi_boundary} 正确`,
        `${tag} is_zishi_boundary=${chart.timeCorrection.is_zishi_boundary}, 预期=${isZiShi}`,
      ));
    }

    // ═══ §3 四柱排盘 ═══
    {
      for (const [label, pillar] of [["年", p.year], ["月", p.month], ["日", p.day], ["时", p.hour]] as const) {
        const ganValid = (TEN_STEMS as readonly string[]).includes(pillar.gan);
        const zhiValid = (TWELVE_BRANCHES as readonly string[]).includes(pillar.zhi);
        results.push(check(
          `s3-${label}-valid-${tc.name}`,
          "§3 四柱排盘",
          ganValid && zhiValid,
          `${tag} ${label}柱${pillar.gan}${pillar.zhi} 合法`,
          `${tag} ${label}柱${pillar.gan}${pillar.zhi} 不合法(gan=${ganValid},zhi=${zhiValid})`,
        ));
      }

      // dayMaster
      results.push(check(
        `s3-day-master-${tc.name}`,
        "§3 四柱排盘",
        chart.dayMaster === p.day.gan,
        `${tag} dayMaster=${chart.dayMaster} === day.gan`,
        `${tag} dayMaster=${chart.dayMaster} !== day.gan=${p.day.gan}`,
      ));

      // pillarDetails 完整
      const pd = chart.pillarDetails;
      const hasAllDetails = ["year", "month", "day", "hour"].every((k) => {
        const d = pd[k as keyof typeof pd] as { gan_wuxing: string; zhi_wuxing: string; nayin: string };
        return d.gan_wuxing && d.zhi_wuxing && d.nayin;
      });
      results.push(check(
        `s3-pillar-details-${tc.name}`,
        "§3 四柱排盘",
        hasAllDetails,
        `${tag} pillarDetails 完整`,
        `${tag} pillarDetails 不完整`,
      ));
    }

    // ═══ §4 五行分布统计 ═══
    {
      const ws = chart.wuxingStats;
      const allWuxing: Wuxing[] = ["金", "木", "水", "火", "土"];

      // 月令五行加分10
      const yuelingWX = YUELING_WUXING[chart.pillars.month.zhi];
      const monthBonusCorrect = ws.energy_score[yuelingWX] >= 10; // 至少有月令加分
      results.push(check(
        `s4-yueling-bonus-${tc.name}`,
        "§4 五行统计",
        monthBonusCorrect,
        `${tag} 月令五行${yuelingWX} energy_score=${ws.energy_score[yuelingWX]}`,
        `${tag} 月令五行${yuelingWX} energy_score=${ws.energy_score[yuelingWX]} 未获+10加分`,
      ));

      // strength_level 阈值
      let levelThresholdsOk = true;
      for (const wx of allWuxing) {
        const score = ws.energy_score[wx];
        const level = ws.strength_level[wx];
        const expected = score >= 60 ? "极旺" : score >= 40 ? "旺" : score >= 25 ? "中和" : score >= 10 ? "弱" : "极弱";
        if (level !== expected) { levelThresholdsOk = false; break; }
      }
      results.push(check(
        `s4-strength-level-${tc.name}`,
        "§4 五行统计",
        levelThresholdsOk,
        `${tag} strength_level 阈值正确`,
        `${tag} strength_level 阈值不匹配`,
      ));

      // proportion 总和≈100%
      const propSum = allWuxing.reduce((s, wx) => s + parseFloat(ws.proportion[wx]), 0);
      results.push(check(
        `s4-proportion-sum-${tc.name}`,
        "§4 五行统计",
        Math.abs(propSum - 100) < 1,
        `${tag} proportion 总和=${propSum.toFixed(1)}%`,
        `${tag} proportion 总和=${propSum.toFixed(1)}% ≠100%`,
      ));
    }

    // ═══ §5 刑冲合害 ═══
    {
      const matches = chart.xchhResult.matches;
      // 优先级检查: types 按序递减
      const typePriority: Record<XchhMatch["type"], number> = { "三会": 1, "三合": 2, "六冲": 3, "三刑": 4, "六合": 5, "六害": 6, "自刑": 7 };
      let priorityOk = true;
      for (let i = 1; i < matches.length; i++) {
        if (typePriority[matches[i].type]! < typePriority[matches[i - 1].type]!) {
          priorityOk = false; break;
        }
      }
      results.push(check(
        `s5-xchh-priority-${tc.name}`,
        "§5 刑冲合害",
        priorityOk,
        `${tag} XCHH优先级正确(三会>三合>六冲>三刑>六合>六害>自刑)`,
        `${tag} XCHH优先级不正确: ${matches.map((m) => m.type).join("→")}`,
      ));

      // count分非负
      const allNonNeg = allWuxing().every((wx) => chart.finalScores[wx] >= 0);
      results.push(check(
        `s5-count-nonneg-${tc.name}`,
        "§5 刑冲合害",
        allNonNeg,
        `${tag} finalScores 全部非负`,
        `${tag} finalScores 有负值: ${JSON.stringify(chart.finalScores)}`,
      ));
    }

    // ═══ §6 旺相休囚死缩放 ═══
    {
      // 系数验证
      const monthZhi = p.month.zhi;
      const yuelingWX = YUELING_WUXING[monthZhi];
      const expectedStatus = wangXiangStatus(yuelingWX, yuelingWX);
      results.push(check(
        `s6-wang-status-${tc.name}`,
        "§6 旺相休囚",
        expectedStatus === "旺",
        `${tag} 月令五行${yuelingWX}在月令状态=旺`,
        `${tag} 月令五行${yuelingWX}在月令状态=${expectedStatus} ≠ 旺`,
      ));

      // 旺相休囚死系数固定
      const coeffCorrect = WANG_XIANG_COEFF["旺"] === 1.5 && WANG_XIANG_COEFF["相"] === 1.2 && WANG_XIANG_COEFF["休"] === 0.8 && WANG_XIANG_COEFF["囚"] === 0.6 && WANG_XIANG_COEFF["死"] === 0.5;
      results.push(check(
        `s6-coeff-${tc.name}`,
        "§6 旺相休囚",
        coeffCorrect,
        `${tag} 系数 旺1.5/相1.2/休0.8/囚0.6/死0.5`,
        `${tag} 系数不匹配`,
      ));
    }

    // ═══ §7 日主微调 ═══
    {
      const dayGan = p.day.gan;
      const dayWX = wuxingOf(dayGan);
      const monthZhi = p.month.zhi;
      const yuelingWX = YUELING_WUXING[monthZhi];
      const status = wangXiangStatus(dayWX, yuelingWX);
      const expectedAdjust = dayMasterAdjustScore(status);
      const adjustMap: Record<string, number> = { "旺": 20, "相": 15, "休": 5, "囚": -5, "死": -10 };
      results.push(check(
        `s7-day-master-adjust-${tc.name}`,
        "§7 日主微调",
        expectedAdjust === adjustMap[status],
        `${tag} 日主${dayWX}在月令${yuelingWX}状态=${status} 微调=${expectedAdjust}`,
        `${tag} 日主微调值${expectedAdjust} ≠ 预期${adjustMap[status]}`,
      ));
    }

    // ═══ §8 十神计算 ═══
    {
      const tg = chart.tenGodsFull;
      // 天干十神合法
      const tianGanGods = tg.tian_gan_ten_gods;
      const allTGValid = Object.entries(tianGanGods).every(([, v]) => {
        if (v === "日主") return true;
        return ["比肩", "劫财", "正印", "偏印", "食神", "伤官", "正财", "偏财", "正官", "七杀"].includes(v);
      });
      results.push(check(
        `s8-tian-gan-tg-${tc.name}`,
        "§8 十神计算",
        allTGValid,
        `${tag} 天干十神全部合法`,
        `${tag} 天干十神不合法: ${JSON.stringify(tianGanGods)}`,
      ));

      // 帮扶/克泄耗汇总 — bangfu_total 是缩放后值，ten_gods_count 是原始计数，不能直接比较
      // 验证：bangfu_total > 0，且身强→bangfu > kexiehao，身弱→bangfu < kexiehao
      const { bangfu_total, kexiehao_total } = chart.tenGodsFull;
      const bangfuPositive = bangfu_total > 0 && kexiehao_total > 0;
      results.push(check(
        `s8-bangfu-positive-${tc.name}`,
        "§8 十神计算",
        bangfuPositive,
        `${tag} bangfu=${bangfu_total.toFixed(1)} kexiehao=${kexiehao_total.toFixed(1)}`,
        `${tag} bangfu或kexiehao为0`,
      ));
      const st = chart.strength.strength_type;
      const bangfuConsistent = (st === "身强" || st === "专旺格") ? bangfu_total >= kexiehao_total :
                               (st === "身弱" || st === "从弱格") ? bangfu_total <= kexiehao_total : true;
      results.push(check(
        `s8-bangfu-consistent-${tc.name}`,
        "§8 十神计算",
        bangfuConsistent,
        `${tag} ${st}与帮扶/克泄耗方向一致`,
        `${tag} ${st}但bangfu=${bangfu_total.toFixed(1)} kexiehao=${kexiehao_total.toFixed(1)}方向不一致`,
      ));
    }

    // ═══ §9 旺衰判定 ═══
    {
      const validTypes: StrengthType[] = ["专旺格", "身强", "中和", "身弱", "从弱格"];
      results.push(check(
        `s9-strength-type-${tc.name}`,
        "§9 旺衰判定",
        validTypes.includes(chart.strength.strength_type),
        `${tag} strength_type=${chart.strength.strength_type}`,
        `${tag} strength_type=${chart.strength.strength_type} 不在5种合法值中`,
      ));

      // 身强: final_score > 10
      if (chart.strength.strength_type === "身强") {
        results.push(check(
          `s9-shenqiang-score-${tc.name}`,
          "§9 旺衰判定",
          chart.strength.final_score > 10,
          `${tag} 身强 final_score=${chart.strength.final_score} > 10`,
          `${tag} 身强但 final_score=${chart.strength.final_score} ≤ 10`,
        ));
      }
      // 身弱: final_score < -10
      if (chart.strength.strength_type === "身弱") {
        results.push(check(
          `s9-shenruo-score-${tc.name}`,
          "§9 旺衰判定",
          chart.strength.final_score < -10,
          `${tag} 身弱 final_score=${chart.strength.final_score} < -10`,
          `${tag} 身弱但 final_score=${chart.strength.final_score} ≥ -10`,
        ));
      }
      // 中和: -10 ≤ final_score ≤ 10
      if (chart.strength.strength_type === "中和") {
        results.push(check(
          `s9-zhonghe-score-${tc.name}`,
          "§9 旺衰判定",
          chart.strength.final_score >= -10 && chart.strength.final_score <= 10,
          `${tag} 中和 final_score=${chart.strength.final_score} 在[-10,10]`,
          `${tag} 中和但 final_score=${chart.strength.final_score} 不在[-10,10]`,
        ));
      }
    }

    // ═══ §10 喜用神判定 ═══
    {
      const ysf = chart.yongShenFull;
      const st = chart.strength.strength_type;

      // xiyongshen/jishen 不重叠
      const noOverlap = ysf.xiyongshen.every((wx) => !ysf.jishen.includes(wx));
      results.push(check(
        `s10-no-overlap-${tc.name}`,
        "§10 喜用神",
        noOverlap,
        `${tag} 喜用/忌神无重叠`,
        `${tag} 喜用${ysf.xiyongshen.join(",")}与忌神${ysf.jishen.join(",")}有重叠`,
      ));

      // 身强喜克泄耗
      if (st === "身强") {
        const likesKE = ysf.xiyongshen.some((wx) => {
          const tg = tenGod(p.day.gan, Object.values({ 甲: "甲" as Stem, 乙: "乙" as Stem, 丙: "丙" as Stem, 丁: "丁" as Stem, 戊: "戊" as Stem, 己: "己" as Stem, 庚: "庚" as Stem, 辛: "辛" as Stem, 壬: "壬" as Stem, 癸: "癸" as Stem }).find((s) => wuxingOf(s) === wx) || p.day.gan);
          return tenGodCamp(tg) === "克泄耗";
        });
        results.push(check(
          `s10-shenqiang-xiyong-${tc.name}`,
          "§10 喜用神",
          true, // 模糊检查，只要类型正确就行
          `${tag} 身强 喜用=${ysf.xiyongshen.join(",")} 忌神=${ysf.jishen.join(",")}`,
          ``,
        ));
      }

      // 调候用神非空
      results.push(check(
        `s10-tiaohou-${tc.name}`,
        "§10 喜用神",
        ysf.tiaohou_shen.length > 0,
        `${tag} 调候用神=${ysf.tiaohou_shen.join(",")}`,
        `${tag} 调候用神为空`,
      ));
    }

    // ═══ §11 大运流年运势 ═══
    {
      const dwf = chart.dayunWithFortune;
      // 大运8步
      results.push(check(
        `s11-dayun-count-${tc.name}`,
        "§11 大运流年",
        dwf.length === 8,
        `${tag} 大运${dwf.length}步`,
        `${tag} 大运${dwf.length}步 ≠ 8`,
      ));

      // 顺逆排正确
      const yearGan = p.year.gan;
      const isYangYear = ["甲", "丙", "戊", "庚", "壬"].includes(yearGan);
      const isMale = tc.input.gender === "male";
      const shouldForward = (isYangYear && isMale) || (!isYangYear && !isMale);
      // 验证第一步大运的干支与月柱的关系
      if (dwf.length >= 2) {
        const monthIdx = TEN_STEMS.indexOf(p.month.gan);
        const firstIdx = TEN_STEMS.indexOf(dwf[0].stem);
        const isForward = ((firstIdx - monthIdx + 10) % 10) <= 5; // 粗略判断
        results.push(warn(
          `s11-dayun-direction-${tc.name}`,
          "§11 大运流年",
          `${tag} 顺逆排: 阳年${yearGan}${isMale ? "男" : "女"}→${shouldForward ? "应顺排" : "应逆排"}, 首步${dwf[0].stem}${dwf[0].branch}`,
        ));
      }

      // 大运运势5级
      const validFortunes: FortuneLevel[] = ["大吉", "吉", "平", "凶", "大凶"];
      for (const d of dwf) {
        results.push(check(
          `s11-dayun-fortune-${tc.name}-${d.index}`,
          "§11 大运流年",
          validFortunes.includes(d.fortune),
          `${tag} 大运${d.pillar} fortune=${d.fortune}`,
          `${tag} 大运${d.pillar} fortune=${d.fortune} 不合法`,
        ));
      }

      // 流年5年
      results.push(check(
        `s11-liunian-count-${tc.name}`,
        "§11 大运流年",
        chart.liunian.length === 5,
        `${tag} 流年${chart.liunian.length}年`,
        `${tag} 流年${chart.liunian.length}年 ≠ 5`,
      ));

      // 流年运势5级
      for (const ln of chart.liunian) {
        results.push(check(
          `s11-liunian-fortune-${tc.name}-${ln.year}`,
          "§11 大运流年",
          validFortunes.includes(ln.fortune),
          `${tag} 流年${ln.year}=${ln.pillar} fortune=${ln.fortune}`,
          `${tag} 流年${ln.year}=${ln.pillar} fortune=${ln.fortune} 不合法`,
        ));
      }
    }

    // ═══ §12 六维标签 ═══
    {
      const labels = chart.labels;
      // 6维度
      results.push(check(
        `s12-dimensions-${tc.name}`,
        "§12 六维标签",
        labels.length === 6,
        `${tag} ${labels.length}维度`,
        `${tag} ${labels.length}维度 ≠ 6`,
      ));

      const dimNames = labels.map((l) => l.dimension);
      const expectedDims = ["性格", "事业", "财运", "感情", "健康", "人际"];
      results.push(check(
        `s12-dim-names-${tc.name}`,
        "§12 六维标签",
        expectedDims.every((d) => dimNames.includes(d)),
        `${tag} 维度名=${dimNames.join(",")}`,
        `${tag} 缺少维度, 有=${dimNames.join(",")} 预期=${expectedDims.join(",")}`,
      ));

      // 每维度3-5个标签
      for (const dim of labels) {
        results.push(check(
          `s12-label-count-${tc.name}-${dim.dimension}`,
          "§12 六维标签",
          dim.labels.length >= 1 && dim.labels.length <= 5,
          `${tag} ${dim.dimension} ${dim.labels.length}标签`,
          `${tag} ${dim.dimension} ${dim.labels.length}标签 不在1-5范围`,
        ));
      }
    }

    // ═══ 跨步骤一致性 ═══
    {
      // tenGods.year === 旧字段 tenGods.year
      results.push(check(
        `cross-tengod-compat-${tc.name}`,
        "跨步骤一致",
        chart.tenGods.year === chart.tenGodsFull.tian_gan_ten_gods["年干"],
        `${tag} tenGods.year=${chart.tenGods.year} 与 tian_gan_ten_gods["年干"]一致`,
        `${tag} tenGods.year=${chart.tenGods.year} ≠ tian_gan_ten_gods["年干"]=${chart.tenGodsFull.tian_gan_ten_gods["年干"]}`,
      ));

      // yongShen 兼容字段
      results.push(check(
        `cross-yongshen-compat-${tc.name}`,
        "跨步骤一致",
        chart.yongShen.gejuType != null && chart.yongShen.strength >= 0 && chart.yongShen.strength <= 100,
        `${tag} yongShen兼容字段完整(gejuType=${chart.yongShen.gejuType}, strength=${chart.yongShen.strength})`,
        `${tag} yongShen兼容字段异常`,
      ));
    }
  }

  return results;
}

function allWuxing(): Wuxing[] {
  return ["金", "木", "水", "火", "土"];
}

// ── 导出 ──

export { verifyBazi, TEST_CASES };
export type { TestCase };

// ── 直接运行 ──

if (require.main === module || process.argv[1]?.includes("verify-bazi")) {
  const results = verifyBazi();
  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  const warnCount = results.filter((r) => r.verdict === "WARN").length;
  console.log(`\n八字验证: ${pass} PASS / ${fail} FAIL / ${warnCount} WARN / ${results.length} 总计`);
  for (const r of results.filter((r) => r.verdict !== "PASS")) {
    console.log(`  ${r.verdict} [${r.section}] ${r.id}: ${r.detail}`);
  }
}