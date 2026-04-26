import {
  branchHourRange,
  wuxingOf,
  TWELVE_BRANCHES,
  type Wuxing,
  type Branch,
} from "@/lib/bazi/stems-branches";
import type { DayPillar } from "@/lib/bazi/today";

/**
 * 6 幸运属性（spec §5.3 简化版）
 *
 * - 幸运色：当日五行对应色（素笺仙气配色映射）
 * - 幸运方位：当日地支所属方位
 * - 幸运时辰：日柱地支三合时辰范围
 * - 幸运数：当日地支序数（1-12）
 * - 幸运花 / 事物：按当日五行查静态表
 *
 * 全部可硬替换：到位后 lib/fortune/attributes.ts 整文件重写。
 */

export interface Attributes {
  color: { name: string; hex: string };
  direction: string;
  hour: { branch: Branch; range: string };
  number: number;
  flower: string;
  item: string;
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

/**
 * 三合时辰：每个地支三合的另两个地支取一个最适合的时辰
 *  申-子-辰 / 亥-卯-未 / 寅-午-戌 / 巳-酉-丑
 */
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

export function computeAttributes(day: DayPillar): Attributes {
  const dayWuxing = wuxingOf(day.gan);
  const luckyBranch = SAN_HE_BY_BRANCH[day.zhi];
  const range = branchHourRange(luckyBranch);
  const startStr = String(range.startHour).padStart(2, "0");
  const endStr = String(range.endHour).padStart(2, "0");
  const number = TWELVE_BRANCHES.indexOf(day.zhi) + 1;

  return {
    color: COLOR_BY_WUXING[dayWuxing],
    direction: DIRECTION_BY_BRANCH[day.zhi],
    hour: {
      branch: luckyBranch,
      range: `${startStr}:00–${endStr}:00`,
    },
    number,
    flower: FLOWER_BY_WUXING[dayWuxing],
    item: ITEM_BY_WUXING[dayWuxing],
  };
}
