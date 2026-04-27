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

export type ProgressVariant = "default" | "bazi" | "meihua";

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
  /** M4.24 仪式特化：bazi/meihua 切到古铜金 + 卦象 SVG */
  variant?: ProgressVariant;
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
  variant = "default",
}: ProgressLongTaskCardProps) {
  const showCancel = (cancellable ?? Boolean(onCancel)) && onCancel;
  const indeterminate = typeof percent !== "number";
  const clampedPercent = indeterminate
    ? 0
    : Math.max(0, Math.min(100, Math.round(percent)));

  if (variant === "default") {
    return (
      <GlassCard className={cn("space-y-3 p-4", className)} data-testid="progress-long-task-default">
        <ProgressHead stage={stage} etaSec={etaSec} />
        <ProgressBar
          stage={stage}
          indeterminate={indeterminate}
          clampedPercent={clampedPercent}
          accentClass="bg-[var(--color-accent-plum)]/70"
          accentIndetClass="bg-[var(--color-accent-plum)]/60"
          trackClass="bg-[var(--color-accent-lavender)]/20"
        />
        <CancelRow show={Boolean(showCancel)} onCancel={onCancel} />
      </GlassCard>
    );
  }

  // bazi / meihua 仪式特化：古铜金 + 卦象 SVG 装饰
  return (
    <div
      data-testid={`progress-long-task-${variant}`}
      className={cn(
        "relative space-y-3 overflow-hidden rounded-[16px] border border-[#a87c5e]/35 p-4 shadow-[0_8px_24px_rgba(168,124,94,0.18)]",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, #2A2118 0%, #4A3624 50%, #6B4E2E 100%)",
      }}
    >
      <RitualGlyph variant={variant} />
      <div className="relative z-10">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[#E8C98A]">
            {STAGE_LABEL[stage]}
          </p>
          {typeof etaSec === "number" && etaSec > 0 && (
            <span className="text-[11px] tracking-ritual2 text-[#D4A155]/85">
              约 {etaSec}s
            </span>
          )}
        </div>
        <div className="mt-3">
          <ProgressBar
            stage={stage}
            indeterminate={indeterminate}
            clampedPercent={clampedPercent}
            accentClass="bg-[#E8C98A]"
            accentIndetClass="bg-[#E8C98A]/85"
            trackClass="bg-[#3A2D1F]"
          />
        </div>
        {showCancel && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-[#a87c5e]/55 bg-[#2A2118]/70 px-3 py-1 text-[11px] tracking-ritual2 text-[#E8C98A] hover:bg-[#a87c5e]/25"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProgressHeadProps {
  stage: LongTaskStage;
  etaSec?: number;
}
function ProgressHead({ stage, etaSec }: ProgressHeadProps) {
  return (
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
  );
}

interface ProgressBarProps {
  stage: LongTaskStage;
  indeterminate: boolean;
  clampedPercent: number;
  accentClass: string;
  accentIndetClass: string;
  trackClass: string;
}
function ProgressBar({
  stage,
  indeterminate,
  clampedPercent,
  accentClass,
  accentIndetClass,
  trackClass,
}: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-label={STAGE_LABEL[stage]}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clampedPercent}
      aria-busy={indeterminate ? true : undefined}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", trackClass)}
    >
      {indeterminate ? (
        <div
          className={cn("h-full w-1/3 animate-pulse rounded-full", accentIndetClass)}
          style={{ animation: "qy-indet 1.4s ease-in-out infinite" }}
        />
      ) : (
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", accentClass)}
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
  );
}

interface CancelRowProps {
  show: boolean;
  onCancel?: () => void;
}
function CancelRow({ show, onCancel }: CancelRowProps) {
  if (!show) return null;
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/30 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)] hover:bg-[var(--color-accent-lavender)]/20"
      >
        取消
      </button>
    </div>
  );
}

/**
 * M4.24 卦象 SVG 装饰：bazi 八卦圆 / meihua 六爻
 * 自画 SVG，零外部资源。古铜金描边 + 半透明，作为背景装饰不抢主体。
 */
function RitualGlyph({ variant }: { variant: "bazi" | "meihua" }) {
  if (variant === "bazi") {
    return (
      <svg
        aria-hidden
        data-testid="ritual-glyph-bazi"
        viewBox="0 0 100 100"
        className="absolute -right-3 -top-3 h-24 w-24 opacity-25"
      >
        <circle cx="50" cy="50" r="35" fill="none" stroke="#E8C98A" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="22" fill="none" stroke="#E8C98A" strokeWidth="0.6" />
        {/* 8 经卦标记线 */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (Math.PI * i) / 4;
          const x1 = 50 + Math.cos(a) * 22;
          const y1 = 50 + Math.sin(a) * 22;
          const x2 = 50 + Math.cos(a) * 35;
          const y2 = 50 + Math.sin(a) * 35;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#E8C98A"
              strokeWidth="0.6"
            />
          );
        })}
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      data-testid="ritual-glyph-meihua"
      viewBox="0 0 60 80"
      className="absolute -right-2 -top-2 h-20 w-16 opacity-30"
    >
      {/* 6 爻：阳爻 ▬▬ / 阴爻 ▬ ▬，画 6 行示意 */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = 8 + i * 11;
        const yang = i % 2 === 0;
        return yang ? (
          <line
            key={i}
            x1="10"
            y1={y}
            x2="50"
            y2={y}
            stroke="#E8C98A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ) : (
          <g key={i}>
            <line
              x1="10"
              y1={y}
              x2="26"
              y2={y}
              stroke="#E8C98A"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="34"
              y1={y}
              x2="50"
              y2={y}
              stroke="#E8C98A"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
