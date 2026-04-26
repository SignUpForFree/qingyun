"use client";

import * as React from "react";
import Link from "next/link";
import { Stars } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard } from "@/components/su";

const FOCUS_VALUES = [
  "综合",
  "事业",
  "财运",
  "感情",
  "人际",
  "健康",
] as const;
export type BaziFocus = (typeof FOCUS_VALUES)[number];

interface BaziLauncherProps {
  onSubmit: (input: { focus: BaziFocus; userQuestion: string }) => void | Promise<void>;
  busy?: boolean;
  /** 用户已建档（profile + chart 都有）。false 时显示『先去建档』占位 */
  hasProfile?: boolean;
}

/**
 * 八字解读输入栏（spec §6.4 V1.0：纯文字解读，不出 BaziChart 卡）
 *
 * - 顶部 6 个 focus chip 单选
 * - 中段 textarea
 * - 底部 解读按钮（土黄/雾紫渐变 呼应土五行）
 * - 无档案时改显占位卡 + 跳 onboarding 链接
 */
export function BaziLauncher({ onSubmit, busy, hasProfile = true }: BaziLauncherProps) {
  const [focus, setFocus] = React.useState<BaziFocus>("综合");
  const [question, setQuestion] = React.useState("");

  function submit() {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    void onSubmit({ focus, userQuestion: trimmed });
    setQuestion("");
  }

  if (!hasProfile) {
    return (
      <div className="glass hairline sticky bottom-0 z-20 px-3 py-3 border-t border-[var(--color-accent-lavender)]/30">
        <GlassCard className="space-y-2 p-4 text-center">
          <p className="text-sm tracking-ritual text-[var(--color-ink-plum)]">
            还没建档，命盘排不出来呢
          </p>
          <Link
            href="/onboarding"
            className={cn(
              "inline-block rounded-full px-4 py-1.5 text-sm tracking-ritual",
              "bg-gradient-to-br from-[#E8C9A4] to-[#A69AB8] text-white shadow-pill",
              "hover:opacity-90",
            )}
          >
            先去建档 →
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glass hairline sticky bottom-0 z-20 flex flex-col gap-3 px-3 py-3",
        "border-t border-[var(--color-accent-lavender)]/30",
        busy && "opacity-70",
      )}
    >
      <div className="flex flex-wrap gap-1.5">
        {FOCUS_VALUES.map((d) => {
          const active = d === focus;
          return (
            <button
              key={d}
              type="button"
              disabled={busy}
              onClick={() => setFocus(d)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3 py-1 text-xs tracking-ritual2 transition-all",
                "border border-[var(--color-accent-lavender)]/40",
                active
                  ? "bg-gradient-to-br from-[#E8C9A4]/60 to-[#A69AB8]/60 text-[var(--color-ink-plum)]"
                  : "bg-white/40 text-[var(--color-ink-mist)] hover:bg-white/60",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={question}
          disabled={busy}
          placeholder={busy ? "排盘解读中…" : "想看八字哪一段？写一两句…"}
          onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn(
            "min-h-12 max-h-28 resize-none rounded-[16px] bg-white/40 px-4 py-2",
            "text-sm font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
            "placeholder:text-[var(--color-ink-fade)]",
            "focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]",
          )}
        />
        <button
          type="button"
          aria-label="解读"
          onClick={submit}
          disabled={busy || !question.trim()}
          className={cn(
            "flex h-12 shrink-0 items-center justify-center gap-1 rounded-full px-4 transition-all",
            "bg-gradient-to-br from-[#E8C9A4] to-[#A69AB8] text-white shadow-pill",
            "hover:opacity-90 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Stars className="h-4 w-4" />
          <span className="text-sm tracking-ritual">{busy ? "解读…" : "解读"}</span>
        </button>
      </div>

      <p className="px-1 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
        命盘已存档，AI 会结合 4 柱 + 五行 + 大运给出解读
      </p>
    </div>
  );
}
