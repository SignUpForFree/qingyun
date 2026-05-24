import Link from "next/link";
import { GlassCard } from "@/components/su";
import { ScoreRing } from "./ScoreRing";
import { DimensionBars7Vertical } from "./DimensionBars7Vertical";
import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";

interface FortuneSummaryCardProps {
  date: string;
  overall: number;
  scores: DimensionScores7;
  oneLiner: string | null;
  /** card：独立玻璃卡；flat：融入首页顶栏一体区 */
  variant?: "card" | "flat";
}

export function FortuneSummaryCard({
  date,
  overall,
  scores,
  oneLiner,
  variant = "card",
}: FortuneSummaryCardProps) {
  const body = (
    <>
      <div className="grid grid-cols-[auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[12px] font-bold tracking-ritual text-[var(--color-ink-mist)]">
            福 小 运 分 数
          </span>
          <ScoreRing score={overall} size={120} strokeWidth={9} caption="" sparkles={false} />
        </div>
        <DimensionBars7Vertical scores={scores} />
      </div>

      {oneLiner && (
        <p
          className="px-1 text-center font-[family-name:var(--font-serif)] text-[15px] font-bold leading-relaxed tracking-ritual text-[var(--color-ink-plum)]"
          data-testid="hero-one-liner"
        >
          {oneLiner}
        </p>
      )}

      <Link
        href={`/fortune/${date}`}
        className="flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#F0B8C8]/40 to-[#C9A1D9]/40 font-[family-name:var(--font-serif)] text-[14px] font-medium tracking-ritual text-[var(--color-accent-plum)] transition hover:from-[#F0B8C8]/60 hover:to-[#C9A1D9]/60"
        data-testid="fortune-detail-link"
      >
        查 看 运 势 详 情 <span className="ml-1.5">→</span>
      </Link>
    </>
  );

  if (variant === "flat") {
    return (
      <div className="space-y-4" data-testid="fortune-summary-card">
        {body}
      </div>
    );
  }

  return (
    <GlassCard className="space-y-4 p-5" data-testid="fortune-summary-card">
      {body}
    </GlassCard>
  );
}

