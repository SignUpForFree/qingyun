import { GlassCard, Sparkle, WatercolorDot } from "@/components/su";

/**
 * 全局加载态（spec §13 — 与错误页同款"素笺仙气"基调）
 */
export default function GlobalLoading() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <WatercolorDot color="lavender" size={120} className="absolute left-[15%] top-[25%]" />
        <WatercolorDot color="pink" size={100} className="absolute right-[18%] bottom-[30%]" />
      </div>
      <GlassCard className="relative z-10 px-8 py-5 text-center">
        <p className="text-sm tracking-ritual2 text-[var(--color-ink-mist)]">
          正 在 沏 茶 <Sparkle size={10} className="ml-1 animate-pulse" />
        </p>
      </GlassCard>
    </div>
  );
}
