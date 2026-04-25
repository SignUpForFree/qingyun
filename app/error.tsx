"use client";

import { Button } from "@/components/ui/button";
import { GlassCard, Sparkle, WatercolorDot } from "@/components/su";

/**
 * 全局错误边界（spec §13 "小恙" 错误页）
 *
 * - 不用红色，用暖珍珠粉 WatercolorDot
 * - 标题"小 恙 · 请 稍 后 再 试"
 * - 错误详情 mono 10px ink-fade（开发环境显示，生产可隐藏）
 * - 按钮"重 试" outlined 墨紫
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <WatercolorDot color="pink" size={140} className="absolute left-[10%] top-[20%]" />
        <WatercolorDot color="apricot" size={100} className="absolute right-[15%] top-[35%]" />
      </div>

      <GlassCard className="relative z-10 max-w-sm space-y-4 p-7 text-center">
        <h1 className="text-[20px] tracking-ritual2 text-[var(--color-ink-plum)]">
          小 恙 <Sparkle size={12} />
        </h1>
        <p className="text-sm text-[var(--color-ink-mist)]">请稍后再试</p>
        {process.env.NODE_ENV !== "production" && error.message && (
          <p className="break-all rounded-[8px] bg-white/40 px-3 py-2 text-left font-mono text-[10px] text-[var(--color-ink-fade)]">
            {error.message}
            {error.digest && ` · ${error.digest}`}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          className="border-[var(--color-accent-lavender)]/40 text-[var(--color-ink-plum)]"
        >
          重 试
        </Button>
      </GlassCard>
    </div>
  );
}
