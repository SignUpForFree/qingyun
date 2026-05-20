export type Wuxing = "金" | "木" | "水" | "火" | "土";

export type Stem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";

export type Branch =
  | "子"
  | "丑"
  | "寅"
  | "卯"
  | "辰"
  | "巳"
  | "午"
  | "未"
  | "申"
  | "酉"
  | "戌"
  | "亥";

export const TEN_STEMS: readonly Stem[] = [
  "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸",
] as const;

export const TWELVE_BRANCHES: readonly Branch[] = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
] as const;

const STEM_WUXING: Record<Stem, Wuxing> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

const BRANCH_WUXING: Record<Branch, Wuxing> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};

const STEM_YIN_YANG: Record<Stem, "yang" | "yin"> = {
  甲: "yang", 乙: "yin", 丙: "yang", 丁: "yin", 戊: "yang",
  己: "yin", 庚: "yang", 辛: "yin", 壬: "yang", 癸: "yin",
};

export const BRANCH_YIN_YANG: Record<Branch, "yang" | "yin"> = {
  子: "yang", 丑: "yin", 寅: "yang", 卯: "yin", 辰: "yang", 巳: "yin",
  午: "yang", 未: "yin", 申: "yang", 酉: "yin", 戌: "yang", 亥: "yin",
};

export const SHENG_CYCLE: Record<Wuxing, Wuxing> = {
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
};

export const KE_CYCLE: Record<Wuxing, Wuxing> = {
  木: "土", 土: "水", 水: "火", 火: "金", 金: "木",
};

export function isStem(c: string): c is Stem {
  return c in STEM_WUXING;
}

export function isBranch(c: string): c is Branch {
  return c in BRANCH_WUXING;
}

export function wuxingOf(char: Stem | Branch): Wuxing {
  if (isStem(char)) return STEM_WUXING[char];
  if (isBranch(char)) return BRANCH_WUXING[char];
  throw new Error(`未知干支: ${char}`);
}

export function yinyangOfStem(s: Stem): "yang" | "yin" {
  return STEM_YIN_YANG[s];
}

export type TenGod =
  | "比肩" | "劫财" | "正印" | "偏印"
  | "食神" | "伤官" | "正财" | "偏财"
  | "正官" | "七杀";

export function tenGod(dayMaster: Stem, target: Stem): TenGod {
  const meWX = STEM_WUXING[dayMaster];
  const tWX = STEM_WUXING[target];
  const sameYY = STEM_YIN_YANG[dayMaster] === STEM_YIN_YANG[target];

  if (meWX === tWX) return sameYY ? "比肩" : "劫财";
  if (SHENG_CYCLE[tWX] === meWX) return sameYY ? "偏印" : "正印";
  if (SHENG_CYCLE[meWX] === tWX) return sameYY ? "食神" : "伤官";
  if (KE_CYCLE[meWX] === tWX) return sameYY ? "偏财" : "正财";
  if (KE_CYCLE[tWX] === meWX) return sameYY ? "七杀" : "正官";

  throw new Error(`无法判定十神: ${dayMaster} → ${target}`);
}

/** 判定十神类别属于帮扶还是克泄耗 */
export function tenGodCamp(tg: TenGod): "帮扶" | "克泄耗" {
  if (tg === "比肩" || tg === "劫财" || tg === "正印" || tg === "偏印") return "帮扶";
  return "克泄耗";
}

export interface BranchHourRange {
  startHour: number;
  endHour: number;
}

const BRANCH_HOUR: Record<Branch, BranchHourRange> = {
  子: { startHour: 23, endHour: 1 },
  丑: { startHour: 1, endHour: 3 },
  寅: { startHour: 3, endHour: 5 },
  卯: { startHour: 5, endHour: 7 },
  辰: { startHour: 7, endHour: 9 },
  巳: { startHour: 9, endHour: 11 },
  午: { startHour: 11, endHour: 13 },
  未: { startHour: 13, endHour: 15 },
  申: { startHour: 15, endHour: 17 },
  酉: { startHour: 17, endHour: 19 },
  戌: { startHour: 19, endHour: 21 },
  亥: { startHour: 21, endHour: 23 },
};

export function branchHourRange(b: Branch): BranchHourRange {
  return BRANCH_HOUR[b];
}

export function relation(
  from: Wuxing,
  to: Wuxing,
): "same" | "sheng" | "ke" | "shengBy" | "keBy" {
  if (from === to) return "same";
  if (SHENG_CYCLE[from] === to) return "sheng";
  if (KE_CYCLE[from] === to) return "ke";
  if (SHENG_CYCLE[to] === from) return "shengBy";
  if (KE_CYCLE[to] === from) return "keBy";
  throw new Error(`未覆盖的五行关系: ${from} -> ${to}`);
}

// ============ 藏干表（含权重） ============

export type HiddenStemWeight = "本气" | "中气" | "余气";

export interface HiddenStemEntry {
  gan: Stem;
  wuxing: Wuxing;
  yinyang: "yang" | "yin";
  weight: HiddenStemWeight;
  coefficient: number; // 本气=1, 中气=0.5, 余气=0.25
}

const HIDDEN_WEIGHT_COEFF: Record<HiddenStemWeight, number> = {
  本气: 1,
  中气: 0.5,
  余气: 0.25,
};

export const HIDDEN_STEMS_DETAILED: Record<Branch, readonly HiddenStemEntry[]> = {
  子: [{ gan: "癸", wuxing: "水", yinyang: "yin", weight: "本气", coefficient: 1 }],
  丑: [
    { gan: "己", wuxing: "土", yinyang: "yin", weight: "本气", coefficient: 1 },
    { gan: "癸", wuxing: "水", yinyang: "yin", weight: "中气", coefficient: 0.5 },
    { gan: "辛", wuxing: "金", yinyang: "yin", weight: "余气", coefficient: 0.25 },
  ],
  寅: [
    { gan: "甲", wuxing: "木", yinyang: "yang", weight: "本气", coefficient: 1 },
    { gan: "丙", wuxing: "火", yinyang: "yang", weight: "中气", coefficient: 0.5 },
    { gan: "戊", wuxing: "土", yinyang: "yang", weight: "余气", coefficient: 0.25 },
  ],
  卯: [{ gan: "乙", wuxing: "木", yinyang: "yin", weight: "本气", coefficient: 1 }],
  辰: [
    { gan: "戊", wuxing: "土", yinyang: "yang", weight: "本气", coefficient: 1 },
    { gan: "乙", wuxing: "木", yinyang: "yin", weight: "中气", coefficient: 0.5 },
    { gan: "癸", wuxing: "水", yinyang: "yin", weight: "余气", coefficient: 0.25 },
  ],
  巳: [
    { gan: "丙", wuxing: "火", yinyang: "yang", weight: "本气", coefficient: 1 },
    { gan: "庚", wuxing: "金", yinyang: "yang", weight: "中气", coefficient: 0.5 },
    { gan: "戊", wuxing: "土", yinyang: "yang", weight: "余气", coefficient: 0.25 },
  ],
  午: [
    { gan: "丁", wuxing: "火", yinyang: "yin", weight: "本气", coefficient: 1 },
    { gan: "己", wuxing: "土", yinyang: "yin", weight: "中气", coefficient: 0.5 },
  ],
  未: [
    { gan: "己", wuxing: "土", yinyang: "yin", weight: "本气", coefficient: 1 },
    { gan: "丁", wuxing: "火", yinyang: "yin", weight: "中气", coefficient: 0.5 },
    { gan: "乙", wuxing: "木", yinyang: "yin", weight: "余气", coefficient: 0.25 },
  ],
  申: [
    { gan: "庚", wuxing: "金", yinyang: "yang", weight: "本气", coefficient: 1 },
    { gan: "壬", wuxing: "水", yinyang: "yang", weight: "中气", coefficient: 0.5 },
    { gan: "戊", wuxing: "土", yinyang: "yang", weight: "余气", coefficient: 0.25 },
  ],
  酉: [{ gan: "辛", wuxing: "金", yinyang: "yin", weight: "本气", coefficient: 1 }],
  戌: [
    { gan: "戊", wuxing: "土", yinyang: "yang", weight: "本气", coefficient: 1 },
    { gan: "辛", wuxing: "金", yinyang: "yin", weight: "中气", coefficient: 0.5 },
    { gan: "丁", wuxing: "火", yinyang: "yin", weight: "余气", coefficient: 0.25 },
  ],
  亥: [
    { gan: "壬", wuxing: "水", yinyang: "yang", weight: "本气", coefficient: 1 },
    { gan: "甲", wuxing: "木", yinyang: "yang", weight: "中气", coefficient: 0.5 },
  ],
};

// Backward compatible: simple array of stems
export const HIDDEN_STEMS: Record<Branch, readonly Stem[]> = Object.fromEntries(
  (Object.entries(HIDDEN_STEMS_DETAILED) as [Branch, readonly HiddenStemEntry[]][]).map(
    ([b, entries]) => [b, entries.map((e) => e.gan)],
  ),
) as unknown as Record<Branch, readonly Stem[]>;

export function mainHiddenStem(branch: Branch): Stem {
  return HIDDEN_STEMS[branch][0]!;
}

// ============ 60 甲子 + 纳音 ============

export interface Jiazi {
  index: number;
  stem: Stem;
  branch: Branch;
  name: string;
  nayin: string;       // 纳音名称，如"海中金"
  nayinWuxing: Wuxing; // 纳音五行，如"金"
}

const NAYIN_TABLE: readonly [string, Wuxing][] = [
  ["海中金", "金"], ["海中金", "金"],   // 甲子 乙丑
  ["炉中火", "火"], ["炉中火", "火"],   // 丙寅 丁卯
  ["大林木", "木"], ["大林木", "木"],   // 戊辰 己巳
  ["路旁土", "土"], ["路旁土", "土"],   // 庚午 辛未
  ["剑锋金", "金"], ["剑锋金", "金"],   // 壬申 癸酉
  ["山头火", "火"], ["山头火", "火"],   // 甲戌 乙亥
  ["涧下水", "水"], ["涧下水", "水"],   // 丙子 丁丑
  ["城头土", "土"], ["城头土", "土"],   // 戊寅 己卯
  ["白蜡金", "金"], ["白蜡金", "金"],   // 庚辰 辛巳
  ["杨柳木", "木"], ["杨柳木", "木"],   // 壬午 癸未
  ["泉中水", "水"], ["泉中水", "水"],   // 甲申 乙酉
  ["屋上土", "土"], ["屋上土", "土"],   // 丙戌 丁亥
  ["霹雳火", "火"], ["霹雳火", "火"],   // 戊子 己丑
  ["松柏木", "木"], ["松柏木", "木"],   // 庚寅 辛卯
  ["长流水", "水"], ["长流水", "水"],   // 壬辰 癸巳
  ["沙中金", "金"], ["沙中金", "金"],   // 甲午 乙未
  ["山下火", "火"], ["山下火", "火"],   // 丙申 丁酉
  ["平地木", "木"], ["平地木", "木"],   // 戊戌 己亥
  ["壁上土", "土"], ["壁上土", "土"],   // 庚子 辛丑
  ["金箔金", "金"], ["金箔金", "金"],   // 壬寅 癸卯
  ["覆灯火", "火"], ["覆灯火", "火"],   // 甲辰 乙巳
  ["天河水", "水"], ["天河水", "水"],   // 丙午 丁未
  ["大驿土", "土"], ["大驿土", "土"],   // 戊申 己酉
  ["钗钏金", "金"], ["钗钏金", "金"],   // 庚戌 辛亥
  ["桑柘木", "木"], ["桑柘木", "木"],   // 壬子 癸丑
  ["大溪水", "水"], ["大溪水", "水"],   // 甲寅 乙卯
  ["沙中土", "土"], ["沙中土", "土"],   // 丙辰 丁巳
  ["天上火", "火"], ["天上火", "火"],   // 戊午 己未
  ["石榴木", "木"], ["石榴木", "木"],   // 庚申 辛酉
  ["大海水", "水"], ["大海水", "水"],   // 壬戌 癸亥
];

export const JIAZI: readonly Jiazi[] = (() => {
  const out: Jiazi[] = [];
  for (let i = 0; i < 60; i++) {
    const stem = TEN_STEMS[i % 10]!;
    const branch = TWELVE_BRANCHES[i % 12]!;
    const [nayin, nayinWuxing] = NAYIN_TABLE[i]!;
    out.push({ index: i + 1, stem, branch, name: `${stem}${branch}`, nayin, nayinWuxing });
  }
  return out;
})();

export function jiaziAt(index: number): Jiazi {
  if (index < 1 || index > 60) throw new Error(`jiazi index 必须 1-60，传入 ${index}`);
  return JIAZI[index - 1]!;
}

/** 查找干支对应的纳音 */
export function nayinOf(stem: Stem, branch: Branch): Jiazi | undefined {
  return JIAZI.find((j) => j.stem === stem && j.branch === branch);
}

// ============ 天干合化 ============

const STEM_HE: Record<Stem, { partner: Stem; transform: Wuxing }> = {
  甲: { partner: "己", transform: "土" },
  己: { partner: "甲", transform: "土" },
  乙: { partner: "庚", transform: "金" },
  庚: { partner: "乙", transform: "金" },
  丙: { partner: "辛", transform: "水" },
  辛: { partner: "丙", transform: "水" },
  丁: { partner: "壬", transform: "木" },
  壬: { partner: "丁", transform: "木" },
  戊: { partner: "癸", transform: "火" },
  癸: { partner: "戊", transform: "火" },
};

export function stemHe(a: Stem, b: Stem): Wuxing | null {
  return STEM_HE[a].partner === b ? STEM_HE[a].transform : null;
}

// ============ 地支六合（含合化五行+旺地月令+破局冲忌） ============

export interface LiuHeRule {
  pair: readonly [Branch, Branch];
  transform: Wuxing;
  wangdiMonths: readonly Branch[];
  chongTaboo: readonly Branch[];
}

export const LIU_HE_RULES: readonly LiuHeRule[] = [
  { pair: ["子", "丑"], transform: "土", wangdiMonths: ["辰", "戌", "丑", "未"], chongTaboo: ["午", "未"] },
  { pair: ["寅", "亥"], transform: "木", wangdiMonths: ["寅", "卯", "亥"], chongTaboo: ["申", "巳"] },
  { pair: ["卯", "戌"], transform: "火", wangdiMonths: ["巳", "午", "戌"], chongTaboo: ["酉", "辰"] },
  { pair: ["辰", "酉"], transform: "金", wangdiMonths: ["申", "酉", "辰"], chongTaboo: ["戌", "卯"] },
  { pair: ["巳", "申"], transform: "水", wangdiMonths: ["亥", "子", "申"], chongTaboo: ["亥", "寅"] },
  { pair: ["午", "未"], transform: "土", wangdiMonths: ["辰", "戌", "丑", "未"], chongTaboo: ["子", "丑"] },
];

// Backward compatible
export const BRANCH_LIU_HE: Record<Branch, Branch> = {
  子: "丑", 丑: "子", 寅: "亥", 亥: "寅",
  卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰",
  巳: "申", 申: "巳", 午: "未", 未: "午",
};

export function isLiuHe(a: Branch, b: Branch): Wuxing | null {
  if (BRANCH_LIU_HE[a] !== b) return null;
  return wuxingOf(a);
}

// ============ 六冲 ============

export const BRANCH_CHONG: Record<Branch, Branch> = {
  子: "午", 午: "子", 丑: "未", 未: "丑",
  寅: "申", 申: "寅", 卯: "酉", 酉: "卯",
  辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳",
};

export function isChong(a: Branch, b: Branch): boolean {
  return BRANCH_CHONG[a] === b;
}

/** 同类相冲（土冲土，冲力更强）：丑未、辰戌 */
export function isTongleiChong(a: Branch, b: Branch): boolean {
  return (a === "丑" && b === "未") || (a === "未" && b === "丑") ||
         (a === "辰" && b === "戌") || (a === "戌" && b === "辰");
}

// ============ 三合局（含旺地月令+破局冲忌） ============

export interface SanHeRule {
  members: readonly [Branch, Branch, Branch];
  transform: Wuxing;
  wangdiMonths: readonly Branch[];
  chongTaboo: readonly Branch[];
}

export const SAN_HE_RULES: readonly SanHeRule[] = [
  { members: ["申", "子", "辰"], transform: "水", wangdiMonths: ["申", "子", "辰"], chongTaboo: ["午", "戌"] },
  { members: ["亥", "卯", "未"], transform: "木", wangdiMonths: ["亥", "卯", "未"], chongTaboo: ["酉", "丑"] },
  { members: ["寅", "午", "戌"], transform: "火", wangdiMonths: ["寅", "午", "戌"], chongTaboo: ["子", "辰"] },
  { members: ["巳", "酉", "丑"], transform: "金", wangdiMonths: ["巳", "酉", "丑"], chongTaboo: ["卯", "未"] },
];

// Backward compatible
export const SAN_HE_GROUPS: ReadonlyArray<{
  members: readonly [Branch, Branch, Branch];
  transform: Wuxing;
}> = SAN_HE_RULES.map((r) => ({ members: r.members, transform: r.transform }));

export function findSanHe(branches: readonly Branch[]): Wuxing | null {
  for (const g of SAN_HE_GROUPS) {
    if (g.members.every((m) => branches.includes(m))) return g.transform;
  }
  return null;
}

// ============ 三会方 ============

export const SAN_HUI_GROUPS: ReadonlyArray<{
  members: readonly [Branch, Branch, Branch];
  transform: Wuxing;
}> = [
  { members: ["寅", "卯", "辰"], transform: "木" },
  { members: ["巳", "午", "未"], transform: "火" },
  { members: ["申", "酉", "戌"], transform: "金" },
  { members: ["亥", "子", "丑"], transform: "水" },
];

export function findSanHui(branches: readonly Branch[]): Wuxing | null {
  for (const g of SAN_HUI_GROUPS) {
    if (g.members.every((m) => branches.includes(m))) return g.transform;
  }
  return null;
}

// ============ 三刑 ============

export interface SanXingRule {
  members: readonly Branch[];
  type: "循环三刑" | "子卯相刑";
}

export const SAN_XING_RULES: readonly SanXingRule[] = [
  { members: ["寅", "巳", "申"], type: "循环三刑" },
  { members: ["丑", "戌", "未"], type: "循环三刑" },
  { members: ["子", "卯"], type: "子卯相刑" },
];

// ============ 六害 ============

export const LIU_HAI_PAIRS: ReadonlyArray<readonly [Branch, Branch]> = [
  ["子", "未"], ["丑", "午"], ["寅", "巳"],
  ["卯", "辰"], ["申", "亥"], ["酉", "戌"],
];

// ============ 自刑 ============

export const ZI_XING_BRANCHES: readonly Branch[] = ["辰", "午", "酉", "亥"];

// ============ 月令五行表 ============

export const YUELING_WUXING: Record<Branch, Wuxing> = {
  寅: "木", 卯: "木", 巳: "火", 午: "火",
  申: "金", 酉: "金", 子: "水", 亥: "水",
  辰: "土", 未: "土", 戌: "土", 丑: "土",
};

// ============ 旺相休囚死系数表 ============

export type WangXiangStatus = "旺" | "相" | "休" | "囚" | "死";

export const WANG_XIANG_COEFF: Record<WangXiangStatus, number> = {
  旺: 1.5,
  相: 1.2,
  休: 0.8,
  囚: 0.6,
  死: 0.5,
};

/** 根据月令五行和目标五行，判定旺相休囚死状态 */
export function wangXiangStatus(yuelingWuxing: Wuxing, targetWuxing: Wuxing): WangXiangStatus {
  if (targetWuxing === yuelingWuxing) return "旺";
  if (SHENG_CYCLE[yuelingWuxing] === targetWuxing) return "相";
  if (SHENG_CYCLE[targetWuxing] === yuelingWuxing) return "休";
  if (KE_CYCLE[targetWuxing] === yuelingWuxing) return "囚";
  return "死";
}

/** 日主微调加分（仅日主五行） */
export function dayMasterAdjustScore(status: WangXiangStatus): number {
  switch (status) {
    case "旺": return 20;
    case "相": return 15;
    case "休": return 5;
    case "囚": return -5;
    case "死": return -10;
  }
}

// ============ 调候用神 ============

export const TIAOHOU_MAP: Record<string, readonly Wuxing[]> = {
  "寅卯": ["火", "土"],   // 春：暖局
  "巳午": ["水", "金"],   // 夏：降温
  "申酉": ["水", "木"],   // 秋：润燥
  "亥子": ["火", "土"],   // 冬：驱寒
  "辰未戌丑": ["木", "水"], // 四季月：疏土
};

// ============ 通关五行 ============

export const TONGGUAN_MAP: Record<string, Wuxing> = {
  "金木": "水", "木金": "水",
  "木土": "火", "土木": "火",
  "土水": "金", "水土": "金",
  "水火": "木", "火水": "木",
  "火金": "土", "金火": "土",
};
