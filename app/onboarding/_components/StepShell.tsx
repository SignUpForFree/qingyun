"use client";

import { Button } from "@/components/ui/button";
import { GlassCard, Sparkle } from "@/components/su";
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
}

/**
 * onboarding 单步骨架
 *
 * - 顶部进度点 ●●○
 * - STEP {n} 11px ritual3 字距小标
 * - 标题 22px serif ritual2 墨紫
 * - 内容由 children 填
 * - 底部上一步 / 下一步（48px 渐变 CTA）
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
}: StepShellProps) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col p-6">
      <StepIndicator current={step} total={total} className="mb-6" />

      <GlassCard className="flex flex-1 flex-col gap-5 p-6">
        <header className="space-y-1 text-center">
          <p className="font-[family-name:var(--font-serif)] text-[11px] uppercase tracking-ritual3 text-[var(--color-ink-fade)]">
            STEP {step} / {total}
          </p>
          <h2 className="font-[family-name:var(--font-serif)] text-[22px] tracking-ritual2 text-[var(--color-ink-plum)]">
            {title}
            <Sparkle size={12} className="ml-2" />
          </h2>
          {desc && <p className="text-xs text-[var(--color-ink-fade)]">{desc}</p>}
        </header>

        <div className="flex flex-1 flex-col gap-4">{children}</div>

        <footer className="flex gap-2">
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
            className="h-12 flex-1 bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-white shadow-pill hover:opacity-90"
          >
            {loading ? "处理中…" : nextLabel}
          </Button>
        </footer>
      </GlassCard>
    </div>
  );
}
