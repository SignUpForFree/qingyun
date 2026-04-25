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
