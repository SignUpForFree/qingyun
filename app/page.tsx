import { Sparkle, GlassCard, WatercolorDot, Divider } from "@/components/su";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <WatercolorDot color="lavender" size={140} className="absolute left-[10%] top-[15%]" />
        <WatercolorDot color="pink" size={120} className="absolute right-[12%] top-[22%]" />
        <WatercolorDot color="blue" size={160} className="absolute bottom-[18%] left-[35%]" />
      </div>

      <GlassCard className="relative w-full max-w-md space-y-3 p-8 text-center">
        <h1 className="text-3xl tracking-ritual2">
          轻运 AI <Sparkle size={16} />
        </h1>
        <Divider />
        <p className="text-sm text-[var(--color-ink-mist)]">
          骨架期占位页 · 素笺仙气视觉系统已就位
        </p>
        <p className="text-xs text-[var(--color-ink-fade)]">
          P1 W1 D2 · S1+S2 design lab
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <WatercolorDot color="lavender" size={20} />
          <WatercolorDot color="pink" size={20} />
          <WatercolorDot color="jade" size={20} />
          <WatercolorDot color="blue" size={20} />
          <WatercolorDot color="apricot" size={20} />
        </div>
      </GlassCard>
    </main>
  );
}
