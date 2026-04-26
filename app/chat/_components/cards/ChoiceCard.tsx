"use client";
import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  key: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}

export interface ChoiceCardProps {
  title: string;
  options: readonly ChoiceOption[];
  onPick: (key: string) => void;
  busy?: boolean;
  className?: string;
}

/**
 * 通用引导选择卡 — dream_choice / slip_type_picker / meihua_method_picker 复用
 *
 * - options ≥ 3 自动 grid 2 列
 * - busy 禁用全部按钮
 */
export function ChoiceCard({ title, options, onPick, busy, className }: ChoiceCardProps) {
  const cols = options.length > 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <p className="text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]">
        {title}
      </p>
      <div className={cn("grid gap-2", cols)}>
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={busy}
            onClick={() => !busy && onPick(opt.key)}
            className={cn(
              "rounded-[10px] px-3 py-2.5 text-left transition-colors",
              "border border-[var(--color-accent-lavender)]/30 bg-white/40",
              "hover:bg-[var(--color-accent-lavender)]/20",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <div className="flex items-center gap-2">
              {opt.icon}
              <span className="font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
                {opt.label}
              </span>
            </div>
            {opt.hint && (
              <p className="mt-1 text-[10px] text-[var(--color-ink-fade)]">{opt.hint}</p>
            )}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
