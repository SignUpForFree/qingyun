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
  "甲",
  "乙",
  "丙",
  "丁",
  "戊",
  "己",
  "庚",
  "辛",
  "壬",
  "癸",
] as const;

export const TWELVE_BRANCHES: readonly Branch[] = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

const STEM_WUXING: Record<Stem, Wuxing> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

const BRANCH_WUXING: Record<Branch, Wuxing> = {
  子: "水",
  丑: "土",
  寅: "木",
  卯: "木",
  辰: "土",
  巳: "火",
  午: "火",
  未: "土",
  申: "金",
  酉: "金",
  戌: "土",
  亥: "水",
};

const STEM_YIN_YANG: Record<Stem, "yang" | "yin"> = {
  甲: "yang",
  乙: "yin",
  丙: "yang",
  丁: "yin",
  戊: "yang",
  己: "yin",
  庚: "yang",
  辛: "yin",
  壬: "yang",
  癸: "yin",
};

export const SHENG_CYCLE: Record<Wuxing, Wuxing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

export const KE_CYCLE: Record<Wuxing, Wuxing> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
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

export type TenGod =
  | "比肩"
  | "劫财"
  | "正印"
  | "偏印"
  | "食神"
  | "伤官"
  | "正财"
  | "偏财"
  | "正官"
  | "七杀";

/**
 * 十神判定（以日主为我）
 *
 *  同我（同五行）：比肩（同阴阳） / 劫财（异阴阳）
 *  生我（生我五行）：偏印（同） / 正印（异）
 *  我生（我生五行）：食神（同） / 伤官（异）
 *  我克（我克五行）：偏财（同） / 正财（异）
 *  克我（克我五行）：七杀（同） / 正官（异）
 */
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

/** 五行生克关系判定 */
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

// ============ M3.6 60 甲子 + 藏干表 ============

export interface Jiazi {
  index: number; // 1-60
  stem: Stem;
  branch: Branch;
  name: string; // e.g. "甲子"
}

/**
 * 60 甲子枚举（甲子起，到 癸亥）
 *
 * 规则：天干循环 0..9，地支循环 0..11，组成 60 个组合（最小公倍数 60）。
 * stem[i % 10] + branch[i % 12]，i = 0..59。
 */
export const JIAZI: readonly Jiazi[] = (() => {
  const out: Jiazi[] = [];
  for (let i = 0; i < 60; i++) {
    const stem = TEN_STEMS[i % 10]!;
    const branch = TWELVE_BRANCHES[i % 12]!;
    out.push({ index: i + 1, stem, branch, name: `${stem}${branch}` });
  }
  return out;
})();

export function jiaziAt(index: number): Jiazi {
  if (index < 1 || index > 60) throw new Error(`jiazi index 必须 1-60，传入 ${index}`);
  return JIAZI[index - 1]!;
}

/**
 * 藏干表（地支本气 / 中气 / 余气）
 *
 * 顺序：本气在前，从最强到最弱。
 *   寅: 甲(本) 丙(中) 戊(余)
 *   申: 庚(本) 壬(中) 戊(余)
 *   等等
 */
export const HIDDEN_STEMS: Record<Branch, readonly Stem[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

/**
 * 取地支本气（藏干第一位）— 最常用
 */
export function mainHiddenStem(branch: Branch): Stem {
  return HIDDEN_STEMS[branch][0]!;
}

/**
 * 干合（5 对）：甲己合化土 / 乙庚合化金 / 丙辛合化水 / 丁壬合化木 / 戊癸合化火
 */
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

/**
 * 支合 / 三合 / 六合（化简版）
 *  - 六合：子丑/寅亥/卯戌/辰酉/巳申/午未
 *  - 三合：申子辰(水) / 亥卯未(木) / 寅午戌(火) / 巳酉丑(金)
 *  - 三会：寅卯辰(木) / 巳午未(火) / 申酉戌(金) / 亥子丑(水)
 *  - 支冲：子午/丑未/寅申/卯酉/辰戌/巳亥
 */
export const BRANCH_LIU_HE: Record<Branch, Branch> = {
  子: "丑",
  丑: "子",
  寅: "亥",
  亥: "寅",
  卯: "戌",
  戌: "卯",
  辰: "酉",
  酉: "辰",
  巳: "申",
  申: "巳",
  午: "未",
  未: "午",
};

export const BRANCH_CHONG: Record<Branch, Branch> = {
  子: "午",
  午: "子",
  丑: "未",
  未: "丑",
  寅: "申",
  申: "寅",
  卯: "酉",
  酉: "卯",
  辰: "戌",
  戌: "辰",
  巳: "亥",
  亥: "巳",
};

export const SAN_HE_GROUPS: ReadonlyArray<{
  members: readonly [Branch, Branch, Branch];
  transform: Wuxing;
}> = [
  { members: ["申", "子", "辰"], transform: "水" },
  { members: ["亥", "卯", "未"], transform: "木" },
  { members: ["寅", "午", "戌"], transform: "火" },
  { members: ["巳", "酉", "丑"], transform: "金" },
] as const;

export const SAN_HUI_GROUPS: ReadonlyArray<{
  members: readonly [Branch, Branch, Branch];
  transform: Wuxing;
}> = [
  { members: ["寅", "卯", "辰"], transform: "木" },
  { members: ["巳", "午", "未"], transform: "火" },
  { members: ["申", "酉", "戌"], transform: "金" },
  { members: ["亥", "子", "丑"], transform: "水" },
] as const;

export function isLiuHe(a: Branch, b: Branch): Wuxing | null {
  if (BRANCH_LIU_HE[a] !== b) return null;
  // 六合化简（妥协版）：取较强一方的五行
  return wuxingOf(a);
}

export function isChong(a: Branch, b: Branch): boolean {
  return BRANCH_CHONG[a] === b;
}

export function findSanHe(branches: readonly Branch[]): Wuxing | null {
  for (const g of SAN_HE_GROUPS) {
    if (g.members.every((m) => branches.includes(m))) return g.transform;
  }
  return null;
}

export function findSanHui(branches: readonly Branch[]): Wuxing | null {
  for (const g of SAN_HUI_GROUPS) {
    if (g.members.every((m) => branches.includes(m))) return g.transform;
  }
  return null;
}
