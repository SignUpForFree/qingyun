import {
  branchHourRange,
  wuxingOf,
  TWELVE_BRANCHES,
  type Wuxing,
  type Branch,
  type Stem,
} from "@/lib/bazi/stems-branches";
import type { DayPillar } from "@/lib/bazi/today";
import type { BaziChartV2 } from "@/lib/bazi/chart";
import { computeDayXiyongMatch } from "./first-xiyong";

/**
 * 8 幸运属性（V2 — 基于当日喜用神五行）
 *
 * - 幸运色：当日喜用神五行对应色
 * - 幸运方位：当日地支所属方位
 * - 幸运时辰：主时辰 + 副时辰（三合相关）
 * - 幸运数：当日喜用神五行数字，随机选1-2个（日期稳定）
 * - 幸运花 / 事物 / 配饰 / 食物：按当日喜用神五行查静态表
 */

export interface Attributes {
  color: { name: string; hex: string };
  direction: string;
  hour: { branch: Branch; range: string };
  /** 副时辰（可选） */
  subHour?: { branch: Branch; range: string };
  /** 幸运数字1-2个 */
  numbers: number[];
  number: number; // 向后兼容，取第一个
  flower: string;
  item: string;
  accessory: string;
  food: string;
}

const COLOR_BY_WUXING: Record<Wuxing, { name: string; hex: string }> = {
  金: { name: "象牙白", hex: "#E8D4E8" },
  木: { name: "新柳绿", hex: "#BFD9C2" },
  水: { name: "雾烟蓝", hex: "#A4B8E8" },
  火: { name: "胭脂粉", hex: "#F0B8C8" },
  土: { name: "杏沙黄", hex: "#E8C9A4" },
};

const DIRECTION_BY_BRANCH: Record<Branch, string> = {
  子: "正北",
  丑: "东北",
  寅: "东北",
  卯: "正东",
  辰: "东南",
  巳: "东南",
  午: "正南",
  未: "西南",
  申: "西南",
  酉: "正西",
  戌: "西北",
  亥: "西北",
};

const SAN_HE_BY_BRANCH: Record<Branch, Branch> = {
  申: "子",
  子: "辰",
  辰: "申",
  亥: "卯",
  卯: "未",
  未: "亥",
  寅: "午",
  午: "戌",
  戌: "寅",
  巳: "酉",
  酉: "丑",
  丑: "巳",
};

/** 三合局中另一个地支作为副时辰 */
const SAN_HE_PARTNER: Record<Branch, Branch> = {
  申: "辰",
  子: "申",
  辰: "子",
  亥: "未",
  卯: "亥",
  未: "卯",
  寅: "戌",
  午: "寅",
  戌: "午",
  巳: "丑",
  酉: "巳",
  丑: "酉",
};

const FLOWER_BY_WUXING: Record<Wuxing, string> = {
  金: "白菊",
  木: "栀子",
  水: "睡莲",
  火: "玫瑰",
  土: "桂花",
};

const ITEM_BY_WUXING: Record<Wuxing, string> = {
  金: "银饰一枚",
  木: "一卷书",
  水: "杯白水",
  火: "一支烛",
  土: "陶杯一只",
};

const ACCESSORY_BY_WUXING: Record<Wuxing, string> = {
  金: "银饰 / 白玉",
  木: "玉镯 / 木珠",
  水: "黑曜石 / 珍珠",
  火: "红玛瑙 / 红绳",
  土: "黄水晶 / 陶饰",
};

const FOOD_BY_WUXING: Record<Wuxing, string> = {
  金: "白色食物（杏仁、银耳、白萝卜）",
  木: "绿叶蔬菜（菠菜、青菜、竹笋）",
  水: "黑色食物（黑米、紫菜、黑豆）",
  火: "红色食物（红枣、樱桃、红椒）",
  土: "黄色食物（南瓜、玉米、黄豆）",
};

const NUMBER_BY_WUXING: Record<Wuxing, number[]> = {
  金: [7, 1],
  木: [3, 8],
  水: [1, 6],
  火: [2, 7],
  土: [5, 0],
};

/** 日期稳定的 hash — 同一天同一档案返回同一随机结果 */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function formatHourRange(branch: Branch): string {
  const range = branchHourRange(branch);
  const startStr = String(range.startHour).padStart(2, "0");
  const endStr = String(range.endHour).padStart(2, "0");
  return `${startStr}:00–${endStr}:00`;
}

export function computeAttributes(
  day: DayPillar,
  chart?: BaziChartV2,
): Attributes {
  // V2: 基于当日喜用神五行；无 chart 时回退到日干五行
  let luckyWuxing: Wuxing;
  if (chart) {
    const match = computeDayXiyongMatch(chart, day.gan as Stem, day.zhi as Branch);
    luckyWuxing = match.wuxing;
  } else {
    luckyWuxing = wuxingOf(day.gan);
  }

  // 主时辰：日柱地支三合时辰
  const mainBranch = SAN_HE_BY_BRANCH[day.zhi];
  // 副时辰：三合局中另一地支
  const subBranch = SAN_HE_PARTNER[day.zhi];

  // 幸运数字：从五行数字中随机选1-2个（日期稳定）
  const allNumbers = NUMBER_BY_WUXING[luckyWuxing];
  const seed = hashString(day.date + luckyWuxing);
  const count = seed % 2 === 0 ? 2 : 1;
  const numbers: number[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count && i < allNumbers.length; i++) {
    const idx = (seed + i) % allNumbers.length;
    if (!used.has(allNumbers[idx]!)) {
      numbers.push(allNumbers[idx]!);
      used.add(allNumbers[idx]!);
    }
  }
  // 若去重后不足，补齐
  for (const n of allNumbers) {
    if (numbers.length >= count) break;
    if (!used.has(n)) {
      numbers.push(n);
      used.add(n);
    }
  }

  return {
    color: COLOR_BY_WUXING[luckyWuxing],
    direction: DIRECTION_BY_BRANCH[day.zhi],
    hour: {
      branch: mainBranch,
      range: formatHourRange(mainBranch),
    },
    subHour: subBranch
      ? { branch: subBranch, range: formatHourRange(subBranch) }
      : undefined,
    numbers,
    number: numbers[0] ?? TWELVE_BRANCHES.indexOf(day.zhi) + 1,
    flower: FLOWER_BY_WUXING[luckyWuxing],
    item: ITEM_BY_WUXING[luckyWuxing],
    accessory: ACCESSORY_BY_WUXING[luckyWuxing],
    food: FOOD_BY_WUXING[luckyWuxing],
  };
}