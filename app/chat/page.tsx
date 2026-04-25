import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle } from "@/components/su";

export default function ChatPlaceholderPage() {
  return (
    <>
      <AppHeader title="对话" />
      <div className="flex flex-1 items-center justify-center p-6">
        <GlassCard className="max-w-sm space-y-2 p-6 text-center">
          <h2 className="text-lg tracking-ritual2">
            对话页 <Sparkle size={12} />
          </h2>
          <p className="text-sm text-[var(--color-ink-fade)]">
            P1 G 节占位 · W2 实装 SSE 流式对话
          </p>
        </GlassCard>
      </div>
    </>
  );
}
