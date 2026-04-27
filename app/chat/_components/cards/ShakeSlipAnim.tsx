"use client";
import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";

export interface ShakeSlipAnimProps {
  /** 动画总时长（ms），默认 2000，spec §4.4 */
  durationMs?: number;
  /** 动画结束触发（用于驱动后续 SSE 卡片显示）*/
  onComplete?: () => void;
  /** 自定义文案 */
  label?: string;
  className?: string;
}

const DEFAULT_DURATION_MS = 2000;
const SHAKE_KEYFRAMES = `
@keyframes qy-shake {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  20% { transform: translate3d(-2px, -3px, 0) rotate(-3deg); }
  40% { transform: translate3d(3px, 2px, 0) rotate(3deg); }
  60% { transform: translate3d(-3px, 1px, 0) rotate(-2deg); }
  80% { transform: translate3d(2px, -2px, 0) rotate(2deg); }
}
`;

/**
 * 摇签动画卡（M2.7）
 *
 * - 视觉素笺基线（M4.24 加木纹 + 仪式特化）
 * - durationMs 后触发 onComplete
 * - durationMs 变化时 reset 计时器（同一卡片可复用）
 */
export function ShakeSlipAnim({
  durationMs = DEFAULT_DURATION_MS,
  onComplete,
  label = "摇签中…",
  className,
}: ShakeSlipAnimProps) {
  React.useEffect(() => {
    const id = setTimeout(() => {
      onComplete?.();
    }, durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onComplete]);

  return (
    <GlassCard className={cn("space-y-3 p-6 text-center", className)}>
      <style>{SHAKE_KEYFRAMES}</style>
      <div
        aria-hidden
        className="mx-auto inline-flex h-16 w-10 items-end justify-center rounded-[6px] border border-[var(--color-accent-lavender)]/40 bg-gradient-to-b from-white/40 to-[var(--color-accent-lavender)]/20"
        style={{
          animation: `qy-shake 0.4s ease-in-out infinite`,
        }}
      >
        <span className="mb-2 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          签
        </span>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]"
      >
        {label}
      </p>
    </GlassCard>
  );
}
