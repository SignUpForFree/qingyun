import "server-only";
import type { BaziChartV2 } from "@/lib/bazi/chart";
import { TRIGRAM_WUXING } from "@/lib/meihua/trigrams";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * 八字 V3 解读 prompt 模板 — 十章完整报告版
 *
 * 输出结构（10 部分，严格按序）：
 *   一、开篇结缘话术
 *   二、八字排盘 & 五行总解析
 *   三、十神深度心性解读
 *   四、四大核心分项解读
 *   五、六亲缘分解析
 *   六、当前大运深度拆解
 *   七、近两年流年运势
 *   八、玄学开运干货
 *   九、贵人与小人
 *   十、命局总结 + 人生忠告
 *
 * 设计原则：
 *   - 通俗易懂，拒绝晦涩术语，白话文表达
 *   - 温润、沉稳、佛系、有缘分感的大师口吻
 *   - 不江湖、不神棍、不夸张恐吓
 *   - 所有凶煞转化为提醒、规避、后天改善
 *   - 专业术语必须白话翻译
 */

const SYSTEM_BASE = `你现在扮演一位资深中式玄学命理大师，语气温润、沉稳、佛系、有缘分感，不要江湖气、不要低俗、不要神棍、不要夸张恐吓。

严格根据系统给你的【规则引擎结构化八字JSON数据】生成个人专属八字详解报告。
所有内容必须通俗易懂，拒绝晦涩专业术语，白话文表达，适合普通人阅读。

=====硬性输出格式（顺序绝对不能乱）=====

第一部分：开篇结缘话术
1、开头使用玄学大师温和开场白，讲究缘分、定数、通俗易懂。
2、注明用户出生信息：公历生辰、出生地、真太阳时校正结果、性别。
3、一句话概括用户整体命格气质。

第二部分：八字排盘 & 五行总解析
1、清晰列出四柱八字：年柱、月柱、日柱、时柱，标注每柱五行。
2、精准统计五行个数、五行强弱、明确写出【五行缺失】。
3、解析日主：日主是什么、日主拟人化描述（如壬水为江河、甲木为参天大树）。
4、判定命格身强身弱、格局定性、命局核心病症（如：水泛木浮、金寒水冷）。
5、直白总结：先天命格等级（上等/中上/中等/中下命格）。

第三部分：十神深度心性解读
1、根据比肩、劫财、印星、食伤、财星、官杀，解析性格底层逻辑。
2、写出：别人眼中的你 + 真实内心的你。
3、明确写出性格优点、性格短板、内在内耗根源。

第四部分：四大核心分项解读
1、性格特质：聪明程度、思维模式、软肋、情绪、处事方式。
2、事业财运：赚钱方式、适合赛道、忌讳行业、是否适合合伙、有无偏财、财运节奏、贫富层级。
3、婚姻感情：配偶特征、夫妻宫情况、是否逢冲、早婚晚婚、感情短板、相处建议。
4、健康分析：五行失衡带来的身体问题、寒湿/燥热、重点养护器官、生活禁忌。

第五部分：六亲缘分解析
直白解析：父母缘分、兄弟姐妹、贵人缘分、子女缘分、真心朋友比例。

第六部分：当前大运深度拆解
1、写明当下大运起止年龄、大运干支。
2、拆解大运天干作用、地支作用、刑冲合害带来的变动。
3、本十年人生趋势、机遇、风险、需要守住的底线。

第七部分：近两年流年运势
直白写出本年度、下一年度运势起伏、利好月份、破月、注意事项。

第八部分：玄学开运干货（全部落地、可执行）
1、最适配行业（喜用神行业）、忌讳行业。
2、吉利颜色、禁忌颜色。
3、有利方位、不利方位。
4、适合佩戴饰品材质、禁忌佩戴材质。
5、生活作息、居住环境优化建议。

第九部分：贵人与小人
贵人五行、贵人长相特征、容易遇到贵人的年份；
小人五行、容易招惹小人的场景、规避方法。

第十部分：命局总结 + 人生忠告
1、简短直白总结一生命格优缺点。
2、给出心性修行、做人做事、人生方向的终身忠告。

=====强制文风要求=====
1、禁止生硬机械，要有大师口吻、柔和、有温度、不吓人、不封建。
2、不要绝对凶断，所有凶煞全部转化为提醒、规避、后天改善。
3、专业术语必须白话翻译，例如：寅申冲=生活变动多、异地奔波。
4、全文排版清晰、分段明确、阅读舒适，不要密密麻麻。
5、全文逻辑：先天定局→性格→事业→婚姻→健康→大运→流年→开运→忠告。

=====风控硬性规则=====
禁止：短命、牢狱、破产、血光、离婚必散、绝症等极端恐吓词汇；
所有内容必须：正向、引导、修身、改运、后天努力大于先天命格。`;

export type V2DivinationDim =
  | "综合运势"
  | "事业学业"
  | "财运"
  | "感情姻缘"
  | "人际贵人"
  | "平安健康";

export interface BuildBaziPromptArgs {
  chart: BaziChartV2;
  /** 用户选的解读维度 */
  focus: V2DivinationDim | string;
  /** 用户报的具体问题（可选；优先级高于 focus） */
  userQuestion?: string;
  /** 档案信息（性别 / 出生地 / 历法），用于 prompt 拼接 */
  profile?: {
    gender?: "male" | "female";
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    calendarType?: "solar" | "lunar";
  };
}

export interface BuildBaziPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildBaziPrompt(args: BuildBaziPromptArgs): BuildBaziPromptResult {
  const { chart, focus, userQuestion, profile } = args;

  // ── 神煞分吉/凶/中 ──
  const ji = chart.shensha
    .filter((s) => s.polarity === "吉")
    .map((s) => `${s.name}（${s.interpretation}）`)
    .join("；");
  const xiong = chart.shensha
    .filter((s) => s.polarity === "凶")
    .map((s) => `${s.name}（${s.interpretation}）`)
    .join("；");
  const zhong = chart.shensha
    .filter((s) => s.polarity === "中")
    .map((s) => `${s.name}（${s.interpretation}）`)
    .join("；");

  // ── 流年 ──
  const liunianText = chart.liunian
    .map((l) => `${l.year}=${l.pillar}${l.offset === 0 ? "(本年)" : ""} 运势${l.fortune}`)
    .join("、");

  // ── 大运 ──
  const dayunText = chart.dayunWithFortune
    .map((d) => `${d.stem}${d.branch}(${d.startAge}-${d.endAge}岁) 运势${d.fortune}`)
    .join("、");

  // ── 当前大运 ──
  const currentYear = new Date().getUTCFullYear();
  const birthYear = chart.solarTrueTime ? new Date(chart.solarTrueTime).getUTCFullYear() : currentYear;
  const currentAge = currentYear - birthYear;
  const currentDayun = chart.dayunWithFortune.find(
    (d) => currentAge >= d.startAge && currentAge <= d.endAge,
  );
  const currentDayunText = currentDayun
    ? `${currentDayun.stem}${currentDayun.branch}(${currentDayun.startAge}-${currentDayun.endAge}岁) 运势${currentDayun.fortune}`
    : "未入大运";

  // ── 五行统计 ──
  const fiveText = (Object.entries(chart.fiveElements) as Array<[string, number]>)
    .map(([k, v]) => `${k}${v}`)
    .join(" ");

  const wuxingMissing = (Object.entries(chart.wuxingStats.total_count) as Array<[string, number]>)
    .filter(([, v]) => v === 0)
    .map(([k]) => k);

  const wuxingStrengthText = (Object.entries(chart.wuxingStats.strength_level) as Array<[string, string]>)
    .map(([k, v]) => `${k}:${v}`)
    .join("、");

  const wuxingProportionText = (Object.entries(chart.wuxingStats.proportion) as Array<[string, string]>)
    .map(([k, v]) => `${k}${v}`)
    .join("、");

  // ── 四柱详细 ──
  const pd = chart.pillarDetails;
  const pillarDetailsText = [
    `年柱：${pd.year.gan}${pd.year.zhi}（${pd.year.gan_wuxing}·${pd.year.gan_yinyang === "yang" ? "阳" : "阴"}干 / ${pd.year.zhi_wuxing}·${pd.year.zhi_yinyang === "yang" ? "阳" : "阴"}支）纳音${pd.year.nayin}`,
    `月柱：${pd.month.gan}${pd.month.zhi}（${pd.month.gan_wuxing}·${pd.month.gan_yinyang === "yang" ? "阳" : "阴"}干 / ${pd.month.zhi_wuxing}·${pd.month.zhi_yinyang === "yang" ? "阳" : "阴"}支）纳音${pd.month.nayin}`,
    `日柱：${pd.day.gan}${pd.day.zhi}（${pd.day.gan_wuxing}·${pd.day.gan_yinyang === "yang" ? "阳" : "阴"}干 / ${pd.day.zhi_wuxing}·${pd.day.zhi_yinyang === "yang" ? "阳" : "阴"}支）纳音${pd.day.nayin}`,
    `时柱：${pd.hour.gan}${pd.hour.zhi}（${pd.hour.gan_wuxing}·${pd.hour.gan_yinyang === "yang" ? "阳" : "阴"}干 / ${pd.hour.zhi_wuxing}·${pd.hour.zhi_yinyang === "yang" ? "阳" : "阴"}支）纳音${pd.hour.nayin}`,
  ].join("\n");

  // ── 十神 ──
  const tg = chart.tenGodsFull;
  const tenGodsCountText = (Object.entries(tg.ten_gods_count) as Array<[string, number]>)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}${v}个`)
    .join("、");

  const tenGodsDetailText = [
    `天干十神：${(Object.entries(tg.tian_gan_ten_gods) as Array<[string, string]>).map(([k, v]) => `${k}=${v}`).join("、")}`,
    `帮扶总分：${tg.bangfu_total}　克泄耗总分：${tg.kexiehao_total}`,
  ].join("\n");

  // ── 刑冲合害 ──
  const xchhText = chart.xchhResult.matches.length > 0
    ? chart.xchhResult.matches.map((m) => `${m.type}：${m.branches.join("")}（${m.detail}）`).join("、")
    : "无";

  // ── 六维标签 ──
  const labelsText = chart.labels
    .map((l) => `【${l.dimension}】${l.labels.map((r) => r.label).join("、")}`)
    .join("\n");

  // ── 时空校正 ──
  const tc = chart.timeCorrection;
  const timeCorrText = [
    `真太阳时：${tc.true_solar_time}`,
    `校正后时辰：${tc.real_hour_zhi}时`,
    `所属节气：${tc.solar_term}${tc.is_jieqi_boundary ? "（节气交界，需注意）" : ""}`,
    tc.is_zishi_boundary ? "子时交界（早夜子时需辨）" : "",
    tc.leap_month ? "闰月出生" : "",
  ].filter(Boolean).join("、");

  // ── 喜用神完整 ──
  const ys = chart.yongShenFull;
  const yongShenFullText = [
    `喜用神：${ys.xiyongshen.join("、")}`,
    `用神：${ys.yongshen.join("、")}`,
    `忌神：${ys.jishen.join("、")}`,
    ys.xianshen.length > 0 ? `闲神：${ys.xianshen.join("、")}` : "",
    ys.tiaohou_shen.length > 0 ? `调候神：${ys.tiaohou_shen.join("、")}` : "",
    ys.tongguan_wuxing.length > 0 ? `通关五行：${ys.tongguan_wuxing.join("、")}` : "",
    `解析：${ys.desc}`,
  ].filter(Boolean).join("\n");

  // ── 旺衰 ──
  const strengthText = [
    `身强身弱：${chart.strength.strength_type}`,
    `评分：${chart.strength.final_score}（帮扶${chart.strength.bangfu_total} / 克泄耗${chart.strength.kexiehao_total}）`,
    `描述：${chart.strength.strength_desc}`,
  ].join("\n");

  // ── 用户信息 ──
  const genderText = profile?.gender === "male" ? "男" : profile?.gender === "female" ? "女" : "未提供";
  const birthPlaceText = profile?.birthPlace ?? "未提供";
  const calendarText = profile?.calendarType === "lunar" ? "农历" : "公历";

  const focusLabel = userQuestion ? `${focus} - ${userQuestion}` : focus;
  const systemPrompt = `${SYSTEM_BASE}\n\n本次重点聚焦【${focusLabel}】维度，在第四部分四大核心分项解读中请围绕此维度展开，其他维度适当精简。`;

  const userPromptLines = [
    "===== 用户出生信息 =====",
    `性别：${genderText}`,
    `公历生辰：${profile?.birthDate ?? "未提供"} ${profile?.birthTime ?? ""}`,
    `出生地：${birthPlaceText}`,
    `历法：${calendarText}`,
    `真太阳时校正：${timeCorrText}`,
    "",
    "===== 四柱八字 =====",
    pillarDetailsText,
    `完整八字：${pd.full_pillar}`,
    "",
    "===== 五行总览 =====",
    `五行个数（地支藏干加权）：${fiveText}`,
    `五行强弱：${wuxingStrengthText}`,
    `五行占比：${wuxingProportionText}`,
    `五行特征：${chart.wuxingStats.wuxing_feature}`,
    wuxingMissing.length > 0 ? `五行缺失：${wuxingMissing.join("、")}` : "五行齐全，无缺失",
    "",
    "===== 日主与命格 =====",
    `日主：${chart.dayMaster}`,
    strengthText,
    `格局：${chart.yongShen.gejuType}（强度 ${chart.yongShen.strength}/100）`,
    `用神理由：${chart.yongShen.reason}`,
    "",
    "===== 喜用神完整 =====",
    yongShenFullText,
    "",
    "===== 十神 =====",
    tenGodsCountText,
    tenGodsDetailText,
    "",
    "===== 刑冲合害 =====",
    xchhText,
    "",
    "===== 神煞 =====",
    ji ? `吉神：${ji}` : "",
    zhong ? `中性神煞：${zhong}` : "",
    xiong ? `需注意：${xiong}` : "",
    "",
    "===== 大运 =====",
    `大运 8 步：${dayunText}`,
    `当前大运：${currentDayunText}`,
    "",
    "===== 流年 =====",
    liunianText,
    "",
    "===== 六维标签（AI辅助参考）=====",
    labelsText,
    "",
    `请严格按十章结构生成完整八字详解报告，重点聚焦【${focusLabel}】。`,
  ].filter((l) => l.length > 0);

  return {
    systemPrompt,
    userPrompt: userPromptLines.join("\n"),
  };
}

// 保留旧的类型导出兼容
void TRIGRAM_WUXING;