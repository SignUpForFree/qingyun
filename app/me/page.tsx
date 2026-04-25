import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle } from "@/components/su";

export default function MePlaceholderPage() {
  return (
    <>
      <AppHeader title="我的" />
      <div className="flex flex-1 items-center justify-center p-6">
        <GlassCard className="max-w-sm space-y-2 p-6 text-center">
          <h2 className="text-lg tracking-ritual2">
            我的 <Sparkle size={12} />
          </h2>
          <p className="text-sm text-[var(--color-ink-fade)]">
            P1 G5 占位 · 档案 / 历史 / 设置后续填充
          </p>
        </GlassCard>
      </div>
    </>
  );
}
