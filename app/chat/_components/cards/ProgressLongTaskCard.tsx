"use client";
import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";

export type LongTaskStage = "classifying" | "computing" | "streaming";

const STAGE_LABEL: Record<LongTaskStage, string> = {
  classifying: "识别意图…",
  computing: "推算中…",
  streaming: "AI 正在解读…",
};

export interface ProgressLongTaskCardProps {
  /** 预估完成秒数 */
  etaSec?: number;
  stage?: LongTaskStage;
  /** 0-100；缺省时用不定进度条 */
  percent?: number;
  /** 提供则显示取消按钮 */
  onCancel?: () => void;
  cancellable?: boolean;
  className?: string;
}

/**
 * 长任务进度卡（M2.8，spec §4.4 progress_long_task）
 *
 * 用于八字 / 梅花 / 解梦精准等需要 30s+ 的流程，
 * 显示阶段 + ETA + 进度条 + 可选取消。
 *
 * - percent 为 number → 受控进度条（aria-valuenow）
 * - percent 缺省 → 不定进度条（visual indeterminate）
 * - cancellable 默认按 onCancel 是否提供决定
 */
export function ProgressLongTaskCard({
  etaSec,
  stage = "computing",
  percent,
  onCancel,
  cancellable,
  className,
}: ProgressLongTaskCardProps) {
  const showCancel = (cancellable ?? Boolean(onCancel)) && onCancel;
  const indeterminate = typeof percent !== "number";
  const clampedPercent = indeterminate
    ? 0
    : Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]">
          {STAGE_LABEL[stage]}
        </p>
        {typeof etaSec === "number" && etaSec > 0 && (
          <span className="text-[11px] tracking-ritual2 text-[var(--color-ink-fade)]">
            约 {etaSec}s
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-label={STAGE_LABEL[stage]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : clampedPercent}
        aria-busy={indeterminate ? true : undefined}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-accent-lavender)]/20"
      >
        {indeterminate ? (
          <div
            className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-accent-plum)]/60"
            style={{ animation: "qy-indet 1.4s ease-in-out infinite" }}
          />
        ) : (
          <div
            className="h-full rounded-full bg-[var(--color-accent-plum)]/70 transition-[width] duration-300"
            style={{ width: `${clampedPercent}%` }}
          />
        )}
        <style>{`
          @keyframes qy-indet {
            0% { margin-left: -33%; }
            100% { margin-left: 100%; }
          }
        `}</style>
      </div>

      {showCancel && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/30 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)] hover:bg-[var(--color-accent-lavender)]/20"
          >
            取消
          </button>
        </div>
      )}
    </GlassCard>
  );
}
