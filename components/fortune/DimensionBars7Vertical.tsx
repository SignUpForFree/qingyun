import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";
import { DAILY_7_DIMS } from "@/lib/fortune/daily-7dim";

interface DimensionBars7VerticalProps {
  scores: DimensionScores7;
  /** 柱体高度像素，默认 56 */
  barHeight?: number;
  /** 柱体宽度 tailwind class，默认 w-2.5 */
  barWidthClass?: string;
}

/**
 * 7 维垂直柱图（参考"福小运"风格），与 FortuneSummaryCard 共用。
 * 列内：柱 → label → 数字
 */
export function DimensionBars7Vertical({
  scores,
  barHeight = 56,
  barWidthClass = "w-2.5",
}: DimensionBars7VerticalProps) {
  return (
    <div className="grid grid-cols-7 gap-0.5" data-testid="dimension-bars-7-v">
      {DAILY_7_DIMS.map((dim) => {
        const v = clamp(scores[dim] ?? 60);
        return (
          <div key={dim} className="flex flex-col items-center gap-1">
            <div
              className={`relative ${barWidthClass} overflow-hidden rounded-full bg-[var(--color-accent-lavender)]/22`}
              style={{ height: barHeight }}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-[#C9A1D9] to-[#F0B8C8] transition-[height] duration-500"
                style={{ height: `${v}%` }}
                data-testid={`bar-v-${dim}`}
              />
            </div>
            <span className="whitespace-nowrap text-[10px] text-[var(--color-ink-mist)]">
              {dim}
            </span>
            <span className="num-mono text-[10px] text-[var(--color-ink-plum)]">
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}
