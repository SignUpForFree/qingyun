import Link from "next/link";
import { GlassCard, Sparkle, WatercolorDot } from "@/components/su";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <WatercolorDot color="lavender" size={140} className="absolute left-[10%] top-[20%]" />
        <WatercolorDot color="blue" size={120} className="absolute right-[15%] bottom-[25%]" />
      </div>

      <GlassCard className="relative z-10 max-w-sm space-y-4 p-7 text-center">
        <h1 className="text-[20px] tracking-ritual2 text-[var(--color-ink-plum)]">
          这里 没 有 路 <Sparkle size={12} />
        </h1>
        <p className="text-sm text-[var(--color-ink-mist)]">
          页面找不到，先回去看看吧
        </p>
        <Link
          href="/"
          className="inline-block rounded-[8px] bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] px-5 py-2 text-sm text-white shadow-pill"
        >
          回首页
        </Link>
      </GlassCard>
    </div>
  );
}
