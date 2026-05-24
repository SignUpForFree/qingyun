import { cn } from "@/lib/utils";
import { FortuneSummaryCard } from "./FortuneSummaryCard";
import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";

interface HomeFortuneHeroProps {
  profileSlot: React.ReactNode;
  headerText: string;
  date: string;
  overall: number;
  scores: DimensionScores7;
  oneLiner: string | null;
  className?: string;
}

/**
 * 首页顶部一体区：头像/日期 + 运势分数，全宽渐变底、无独立卡片框
 */
export function HomeFortuneHero({
  profileSlot,
  headerText,
  date,
  overall,
  scores,
  oneLiner,
  className,
}: HomeFortuneHeroProps) {
  return (
    <section
      className={cn(
        "relative w-full overflow-hidden",
        "bg-gradient-to-b from-[#F3E8FA] via-[#FDF8FC] to-[var(--color-bg-paper)]",
        "pb-5 pt-[max(10px,env(safe-area-inset-top))]",
        className,
      )}
      data-testid="home-fortune-hero"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-12 top-8 h-40 w-40 rounded-full bg-[var(--color-accent-lavender)]/25 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 top-16 h-32 w-32 rounded-full bg-[#F0B8C8]/20 blur-3xl"
      />

      <div className="relative z-[1] mx-auto w-full max-w-md px-4">
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="flex min-w-0 items-center justify-start">{profileSlot}</div>
          <p
            className="max-w-[min(58vw,300px)] text-center font-[family-name:var(--font-serif)] text-[13px] font-bold tracking-ritual text-[var(--color-ink-plum)]"
            data-testid="home-lunar-date"
          >
            {headerText}
          </p>
          <div aria-hidden className="min-w-0" />
        </div>

        <FortuneSummaryCard
          variant="flat"
          date={date}
          overall={overall}
          scores={scores}
          oneLiner={oneLiner}
        />
      </div>
    </section>
  );
}
