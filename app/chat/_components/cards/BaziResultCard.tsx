"use client";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { cn } from "@/lib/utils";
import type { BaziPillars, BaziTenGods } from "@/types/domain";
import type { Wuxing } from "@/lib/bazi/stems-branches";

interface BaziChartView {
  pillars: BaziPillars;
  fiveElements: Record<Wuxing, number>;
  dayMaster: string;
  tenGods: BaziTenGods;
  currentLuck: string;
}

interface BaziResultCardProps {
  chart: BaziChartView;
  focus: string;
  aiText: string;
  className?: string;
}

const WUXING_TONE: Record<Wuxing, string> = {
  金: "var(--color-wuxing-metal)",
  木: "var(--color-wuxing-wood)",
  水: "var(--color-wuxing-water)",
  火: "var(--color-wuxing-fire)",
  土: "var(--color-wuxing-earth)",
};

/**
 * 八字结果卡（V1.0 文档 §4）
 *
 * - 顶部 4 柱（年/月/日/时）+ 日主高亮
 * - 五行分布（5 个 dot）
 * - AI 解读文字
 */
export function BaziResultCard({ chart, focus, aiText, className }: BaziResultCardProps) {
  const order: Wuxing[] = ["金", "木", "水", "火", "土"];
  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]">
          八字 · {focus}
        </p>
        <Sparkle size={10} variant="diamond" />
      </div>

      {/* 4 柱 */}
      <div className="grid grid-cols-4 gap-2">
        {(["year", "month", "day", "hour"] as const).map((k) => {
          const p = chart.pillars[k];
          const isDay = k === "day";
          return (
            <div
              key={k}
              className={cn(
                "rounded-[10px] py-2 text-center",
                "border border-[var(--color-accent-lavender)]/30",
                isDay ? "bg-[var(--color-accent-lavender)]/30" : "bg-white/40",
              )}
            >
              <p className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
                {k === "year" ? "年" : k === "month" ? "月" : k === "day" ? "日" : "时"}
              </p>
              <p className="font-[family-name:var(--font-serif)] text-base text-[var(--color-ink-plum)]">
                {p?.gan}
                {p?.zhi}
              </p>
            </div>
          );
        })}
      </div>

      {/* 五行 */}
      <div className="flex items-center justify-around gap-1 text-[10px]">
        {order.map((w) => (
          <span
            key={w}
            className="flex items-center gap-1 text-[var(--color-ink-fade)]"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: WUXING_TONE[w] }}
            />
            {w} {chart.fiveElements[w] ?? 0}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-[var(--color-ink-fade)]">
        日主 <span className="text-[var(--color-accent-plum)]">{chart.dayMaster}</span> · 当前大运{" "}
        {chart.currentLuck}
      </p>

      <Divider />

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-plum)]">
        {aiText}
      </p>
    </GlassCard>
  );
}
