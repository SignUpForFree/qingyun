"use client";

import { Button } from "@/components/ui/button";
import { Sparkle, WatercolorDot } from "@/components/su";
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
  /** @deprecated 三步统一顶部堆叠，不再使用垂直居中 */
  centerContent?: boolean;
}

/**
 * onboarding 单步骨架（design §2 STEP 表单）
 *
 * 仅去掉外层 GlassCard 大框，表单项样式由 children 自行保持。
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
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden px-5 py-6"
      data-testid="onboarding-step-shell"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[10%]" />
        <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[16%]" />
        <WatercolorDot color="blue" size={140} className="absolute bottom-[16%] left-[35%]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <StepIndicator current={step} total={total} className="mb-6" />

        <div className="flex min-h-[calc(100dvh-9rem)] flex-1 flex-col gap-6">
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

          <footer className="mt-auto space-y-2">
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
        </div>
      </div>
    </div>
  );
}
