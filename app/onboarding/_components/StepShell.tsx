"use client";

import { Button } from "@/components/ui/button";
import { GlassCard, Sparkle, WatercolorDot } from "@/components/su";
import { StepIndicator } from "./StepIndicator";

interface StepShellProps {
  step: number;
  total: number;
  title: string;
  desc?: string;
  children: React.ReactNode;
  onPrev?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  /** 跳过精准时间等次链接（design §2 第 198 行） */
  skipLabel?: string;
  onSkip?: () => void;
}

/**
 * onboarding 单步骨架（design §2 STEP 表单）
 *
 * - 顶部进度点 ●●○
 * - STEP {n} 11px ritual3 字距小标 lavender-gray
 * - 标题 22px serif ritual2 墨紫 + ✧ 装饰
 * - 内容由 children 填
 * - 底部上一步 / 下一步（48px 渐变 CTA），下方可选 skip 链接
 * - 全屏 3 颗水彩晕染做仙气底（lavender / pink / blue）
 */
export function StepShell({
  step,
  total,
  title,
  desc,
  children,
  onPrev,
  onNext,
  nextLabel = "下一步",
  nextDisabled,
  loading,
  skipLabel,
  onSkip,
}: StepShellProps) {
  return (
    <div
      className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col overflow-hidden p-6"
      data-testid="onboarding-step-shell"
    >
      {/* 仙气水彩底（与 home 一致风格） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[10%]" />
        <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[16%]" />
        <WatercolorDot color="blue" size={140} className="absolute bottom-[16%] left-[35%]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <StepIndicator current={step} total={total} className="mb-6" />

        <GlassCard className="flex flex-col gap-5 p-6">
          <header className="space-y-1.5 text-center">
            <p
              className="font-[family-name:var(--font-serif)] text-[11px] uppercase tracking-ritual3 text-[var(--color-accent-lavender)]"
              data-testid="onboarding-step-num"
            >
              STEP {step} / {total}
            </p>
            <h2
              className="font-[family-name:var(--font-serif)] text-[22px] tracking-ritual2 text-[var(--color-ink-plum)]"
              data-testid="onboarding-step-title"
            >
              {title}
              <Sparkle size={12} className="ml-2" />
            </h2>
            {desc && (
              <p className="text-xs leading-relaxed text-[var(--color-ink-fade)]">
                {desc}
              </p>
            )}
            {/* ✧ 装饰小行（design §2 第 176 行 "Tiny ✧ decoration below"） */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <span
                aria-hidden
                className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--color-accent-lavender)]/40"
              />
              <Sparkle size={9} variant="asterisk" />
              <span
                aria-hidden
                className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--color-accent-lavender)]/40"
              />
            </div>
          </header>

          <div className="flex flex-col gap-4">{children}</div>

          <footer className="space-y-2">
            <div className="flex gap-2">
              {onPrev && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onPrev}
                  disabled={loading}
                  className="text-[var(--color-ink-mist)]"
                >
                  上一步
                </Button>
              )}
              <Button
                type="button"
                onClick={onNext}
                disabled={nextDisabled || loading}
                className="h-12 flex-1 rounded-[14px] bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] tracking-ritual2 text-white shadow-pill hover:opacity-90"
              >
                {loading ? "处理中…" : nextLabel}
              </Button>
            </div>
            {skipLabel && onSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={loading}
                className="block w-full text-center text-[12px] text-[var(--color-ink-fade)] hover:text-[var(--color-ink-mist)] disabled:opacity-50"
                data-testid="onboarding-skip-link"
              >
                {skipLabel}
              </button>
            )}
          </footer>
        </GlassCard>
      </div>
    </div>
  );
}
