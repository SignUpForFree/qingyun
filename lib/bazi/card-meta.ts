import type { BaziChartV2 } from "@/lib/bazi/chart";

export interface BuildBaziResultCardMetaInput {
  profileId: string;
  focus: string;
  chartV2: BaziChartV2;
  aiText?: string;
}

/** 构建 bazi_result 卡 metadata（排盘完成后立即下发 shell，解读流式写入） */
export function buildBaziResultCardMeta(input: BuildBaziResultCardMetaInput) {
  const { profileId, focus, chartV2, aiText = "" } = input;
  const favorableGods = chartV2.yongShenFull?.xiyongshen;

  return {
    ui: "bazi_result" as const,
    profileId,
    focus,
    chart: {
      pillars: chartV2.pillars,
      fiveElements: chartV2.fiveElements,
      dayMaster: chartV2.dayMaster,
      tenGods: chartV2.tenGods,
      shensha: chartV2.shensha,
      yongShen: chartV2.yongShen,
      luckPillars: chartV2.luckPillars,
      liunian: chartV2.liunian,
      currentLuck: chartV2.luckPillars[0]
        ? `${chartV2.luckPillars[0].gan}${chartV2.luckPillars[0].zhi}`
        : "",
      ...(favorableGods && favorableGods.length > 0
        ? { favorableGods }
        : {}),
    },
    aiText,
  };
}
