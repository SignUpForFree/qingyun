import type { MeihuaV2Result } from "@/lib/divination/meihua-v2";

export const MEIHUA_TIYONG_VERDICT: Record<string, string> = {
  ti_ke_yong: "体克用（自己掌握主动，宜稳中推进）",
  yong_ke_ti: "用克体（外缘较强，需顺势，宜静观待变）",
  ti_sheng_yong: "体生用（主动付出，蓄势于内，宜守本位）",
  yong_sheng_ti: "用生体（外缘加持，顺势而行）",
  bi_he: "体用比和（平稳顺遂，宜守成为主）",
};

export interface MeihuaResultCardMetaInput {
  v2: MeihuaV2Result;
  profileId: string;
  numbers: number[];
  userQuestion: string;
  measuredAtText: string;
  aiText?: string;
}

/** 构建 meihua_result 卡 metadata（起卦后立即下发 shell，解读流式写入 aiText） */
export function buildMeihuaResultCardMeta(input: MeihuaResultCardMetaInput) {
  const { v2, profileId, numbers, userQuestion, measuredAtText, aiText = "" } = input;
  const relation = v2.tiYong.relation;
  const verdict = MEIHUA_TIYONG_VERDICT[relation] ?? relation;

  return {
    ui: "meihua_result" as const,
    profileId,
    numbers,
    measuredAtText,
    userQuestion: userQuestion || undefined,
    ben: {
      name: v2.ben.name,
      upper: v2.ben.upper,
      lower: v2.ben.lower,
      lines: v2.ben.lines,
    },
    hu: {
      name: v2.hu.name,
      upper: v2.hu.upper,
      lower: v2.hu.lower,
      lines: v2.hu.lines,
    },
    bian: {
      name: v2.bian.name,
      upper: v2.bian.upper,
      lower: v2.bian.lower,
      lines: v2.bian.lines,
    },
    dongYao: v2.dongYao,
    tiYong: v2.tiYong,
    bianTiYong: v2.bianTiYong,
    yingQi: v2.yingQi,
    timeEnergy: v2.timeEnergy,
    sunYi: v2.sunYi,
    benDict: v2.benDict,
    huDict: v2.huDict,
    bianDict: v2.bianDict,
    verdict,
    aiText,
  };
}
