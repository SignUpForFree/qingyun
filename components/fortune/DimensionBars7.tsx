import type { DailyDim7, DimensionScores7 } from "@/lib/fortune/daily-7dim";
import { DAILY_7_DIMS } from "@/lib/fortune/daily-7dim";

interface DimensionBars7Props {
  scores: DimensionScores7;
  /** 可选自定义顺序；默认按 DAILY_7_DIMS（爱情→心情） */
  order?: ReadonlyArray<DailyDim7>;
}

/**
 * 首页 7 维度水平条 (M4.2, image2)
 *
 * 与 V1 DimensionBars (5 维) 同色系：粉→紫渐变。每条 56px label + 进度条 + 2 字数字。
 * 顺序：爱情 / 财富 / 事业 / 学习 / 健康 / 人际 / 心情。
 */
export function DimensionBars7({ scores, order }: DimensionBars7Props) {
  const dims = order ?? DAILY_7_DIMS;
  return (
    <div className="space-y-2.5" data-testid="dimension-bars-7">
      {dims.map((dim) => {
        const v = scores[dim] ?? 60;
        return (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-[11px] tracking-ritual text-[var(--color-ink-mist)]">
              {dim}
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-accent-lavender)]/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] transition-[width] duration-500"
                style={{ width: `${clamp(v)}%` }}
                data-testid={`bar-${dim}`}
              />
            </div>
            <span className="num-mono w-7 shrink-0 text-right text-[11px] text-[var(--color-ink-mist)]">
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
