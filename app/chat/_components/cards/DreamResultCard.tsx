"use client";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

interface DreamResultCardProps {
  mode: "fast" | "precise";
  aiText: string;
  className?: string;
}

/**
 * 解梦结果卡（V1.0 文档 §解梦）
 *
 * - mode chip：快速 / 精准
 * - AI 三重维度文本（周公 / 弗洛伊德 / 荣格）
 *
 * V1 不做 emoji 图标位、关键意象 chip 等高级元素，先用纯文字承接。
 */
export function DreamResultCard({ mode, aiText, className }: DreamResultCardProps) {
  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            "border border-[var(--color-accent-lavender)]/40",
            mode === "fast"
              ? "bg-[var(--color-wuxing-water)]/20"
              : "bg-[var(--color-accent-lavender)]/30",
          )}
        >
          {mode === "fast" ? "快 速 解 梦" : "精 准 解 梦"}
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-plum)]">
        {aiText}
      </p>
    </GlassCard>
  );
}
