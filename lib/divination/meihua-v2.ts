import type { Profile } from "@/lib/db/schema";
import type { Branch, Wuxing } from "@/lib/bazi/stems-branches";
import { castByNumbers, castByTime, type CastResult } from "@/lib/meihua/cast";
import { interpretMeihua, type MeihuaResult } from "@/lib/meihua/interpret";
import { findGuaByTrigrams, type Trigram as Gua64Trigram } from "@/db/seed/gua64";
import { computeTimeEnergy, type TimeEnergyResult } from "./time-energy";
import { TRIGRAM_WUXING } from "@/lib/meihua/trigrams";

/**
 * 梅花易数 V2 入口 (M3.17)
 *
 * 把 V1 lib/meihua/* 全套（castByNumbers / interpretMeihua / huGua / bianGua /
 * guaZhongGua / judgeTiYong / computeYingQi）wire 成一个 V2 结果对象。在 M3.16 的
 * 64 卦字典之上叠加 panci / yaoci / tuanci 文本，给 M3.22 prompt 做准备。
 *
 * V2 vs V1 增量（接 M3.18-M3.21）：
 *   - timeEnergy: 时辰能量场（M3.19）— 现为 stub，M3.19 接 lib/divination/time-energy.ts
 *   - sunYi:      五行损益（M3.20）— 现为 stub，M3.20 接 profile.yongShen 联动
 *   - yingQi 已含 hourBranch 精度（V1 已实现 bianGuaHourBranch 字段）
 */

export interface MeihuaV2Args {
  /** 1-3 个数字起卦 */
  numbers?: number[];
  /** 时间起卦（numbers 缺省时使用） */
  date?: Date;
  /** 时辰地支：用于应期（V1 ying-qi.ts 已支持）+ M3.19 timeEnergy */
  hourBranch?: Branch;
  /** 用户具体问题（M3.22 prompt 拼装时用） */
  userQuestion?: string;
  /** 默认档案 / 用户选档案；M3.20 五行损益 + M3.19 timeEnergy 都用 */
  profile: Pick<Profile, "id" | "gender" | "birth_date" | "birth_time" | "bazi_pillars"> | null;
}

export interface MeihuaV2Result extends MeihuaResult {
  /** 64 卦字典里的 panci/yaoci/tuanci，给 M3.22 prompt 用 */
  benDict: GuaDictView;
  huDict: GuaDictView;
  bianDict: GuaDictView;
  /** M3.19 时辰能量场（hourBranch 缺省 → null） */
  timeEnergy: TimeEnergyResult | null;
  /** M3.20 五行损益 — 现为 stub */
  sunYi: SunYiStub;
}

export interface GuaDictView {
  name: string;
  panCi: string;
  yaoCi: ReadonlyArray<string>;
  tuanCi: string;
  /** dongYao 位的爻辞（V1 已传 dongYao 1-6） */
  dongYaoCi?: string;
}

export interface SunYiStub {
  /** profile.yongShen 与卦象主五行的关系（M3.20 实现） */
  yongShenSupported?: boolean;
  /** 各维度 +/- 调整（M3.20 实现） */
  adjustments?: ReadonlyArray<{ dim: string; delta: number }>;
}

export function meihuaV2(args: MeihuaV2Args): MeihuaV2Result {
  const cast = pickCast(args);
  const base = interpretMeihua(cast, args.hourBranch);

  // M3.19 时辰能量场（仅在传入 hourBranch 时计算）
  const timeEnergy: TimeEnergyResult | null = args.hourBranch
    ? computeTimeEnergy({
        hourBranch: args.hourBranch,
        guaWuxing: TRIGRAM_WUXING[base.tiYong.ti] as Wuxing,
        yongShen: pickYongShen(args.profile),
      })
    : null;

  return {
    ...base,
    benDict: buildDictView(base.ben.upper, base.ben.lower, cast.dongYao),
    huDict: buildDictView(base.hu.upper, base.hu.lower, undefined),
    bianDict: buildDictView(base.bian.upper, base.bian.lower, undefined),
    timeEnergy,
    sunYi: {}, // M3.20 stub
  };
}

/**
 * 从 profile.bazi_pillars 缓存里挑出用神 — 缓存只放 pillars，不含 yongShen，
 * 所以 V2 这一步 yongShen 默认 null；M3.20 会扩展缓存把 yongShen 一起存。
 *
 * 暂时返 null，给 timeEnergy.supportYongShen 走 null 兜底分支。
 */
function pickYongShen(_profile: MeihuaV2Args["profile"]): Wuxing | null {
  return null;
}

function pickCast(args: MeihuaV2Args): CastResult {
  if (args.numbers && args.numbers.length > 0) {
    return castByNumbers(...args.numbers);
  }
  return castByTime(args.date ?? new Date());
}

/**
 * 把 V1 trigram (TS 类型 = "乾"|"兑"|"离"|"震"|"巽"|"坎"|"艮"|"坤") 映射到 M3.16
 * gua64.ts 的 Trigram。两个枚举字面值完全一致，仅类型不同 — 直接断言转。
 */
function buildDictView(
  upper: string,
  lower: string,
  dongYao: number | undefined,
): GuaDictView {
  const entry = findGuaByTrigrams(upper as Gua64Trigram, lower as Gua64Trigram);
  if (!entry) {
    return {
      name: `${upper}${lower}`,
      panCi: "",
      yaoCi: [],
      tuanCi: "",
    };
  }
  const yaoArr: ReadonlyArray<string> = JSON.parse(entry.yao_ci);
  const view: GuaDictView = {
    name: entry.name,
    panCi: entry.pan_ci,
    yaoCi: yaoArr,
    tuanCi: entry.tuan_ci,
  };
  if (dongYao && dongYao >= 1 && dongYao <= 6 && yaoArr[dongYao - 1]) {
    return { ...view, dongYaoCi: yaoArr[dongYao - 1] };
  }
  return view;
}
