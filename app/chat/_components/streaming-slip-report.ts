import type { SlipSection } from "@/lib/ai/slip-sections";
import type { SlipImageLevel } from "./cards/SlipImageFullscreen";

/** SSE meta.slipReportShell — 解读流式开始前由服务端下发 */
export interface SlipReportShell {
  slipNumber: number;
  level: SlipImageLevel;
  title: string;
  poem: string;
  dimension: string;
  reading: string;
  isFullInterpret?: boolean;
}

/** 流式解读中的 SlipReportCard 数据 */
export interface StreamingSlipReport extends SlipReportShell {
  aiInterpretation: string;
  sections: SlipSection[];
}
