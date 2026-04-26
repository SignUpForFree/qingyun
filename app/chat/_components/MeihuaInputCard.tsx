"use client";

import * as React from "react";
import { Clock, Hash } from "lucide-react";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

export type MeihuaMethod = "time" | "number";

interface Props {
  onSubmit: (args: { method: MeihuaMethod; numbers?: number[]; userQuestion: string }) => void | Promise<void>;
  busy?: boolean;
}

const SOON = ["报数起卦", "文字起卦", "摇铜钱"];

/**
 * 梅花起卦输入卡（设计 §5 MeihuaInputCard · 素笺仙气）
 *
 * 流程：
 *   1. 顶部 textarea 写下问题
 *   2. 选『时间起卦』或『数字起卦』
 *   3. 数字起卦展开 1-3 个 input → 起卦
 *   4. V1.0.5 三种灰占位：报数 / 文字 / 摇铜钱
 *
 * 风格：墨紫 + 淡紫粉 + 雾紫描边，跟 DivinationLauncher 同体系
 */
export function MeihuaInputCard({ onSubmit, busy }: Props) {
  const [picked, setPicked] = React.useState<MeihuaMethod | null>(null);
  const [question, setQuestion] = React.useState("");
  const [n1, setN1] = React.useState("");
  const [n2, setN2] = React.useState("");
  const [n3, setN3] = React.useState("");

  const trimmed = question.trim();
  const canPick = trimmed.length > 0 && !busy;

  function submitTime() {
    if (!canPick) return;
    void onSubmit({ method: "time", userQuestion: trimmed });
  }

  function submitNumber() {
    if (!canPick) return;
    const numbers = [n1, n2, n3]
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    if (numbers.length === 0) return;
    void onSubmit({ method: "number", numbers, userQuestion: trimmed });
  }

  return (
    <div
      className={cn(
        "glass hairline sticky bottom-0 z-20 px-3 py-3",
        "border-t border-[var(--color-accent-lavender)]/30",
        busy && "opacity-70",
      )}
    >
      <GlassCard className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="font-[family-name:var(--font-serif)] text-[13px] tracking-ritual text-[var(--color-ink-plum)]">
            选 择 起 卦 方 式
          </span>
          <Sparkle size={10} variant="diamond" />
        </div>

        <textarea
          rows={2}
          value={question}
          disabled={busy}
          placeholder={busy ? "起卦中…" : "为眼下哪件事起卦？写一两句…"}
          onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
          className={cn(
            "min-h-12 max-h-24 w-full resize-none rounded-[12px] bg-white/40 px-3 py-2",
            "text-sm font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
            "placeholder:text-[var(--color-ink-fade)]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]",
          )}
        />

        {picked !== "number" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={submitTime}
              disabled={!canPick}
              className={cn(
                "h-14 rounded-[12px] bg-gradient-to-br from-[#FFE8F0] to-white",
                "border border-[var(--color-accent-lavender)]/40 text-left px-3",
                "hover:from-[#FFD8E8] disabled:cursor-not-allowed disabled:opacity-40 transition-all",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[var(--color-accent-lavender)]" strokeWidth={1.5} />
                <span className="font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
                  时 间 起 卦
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--color-ink-fade)]">此 刻 之 兆</p>
            </button>
            <button
              type="button"
              onClick={() => setPicked("number")}
              disabled={!canPick}
              className={cn(
                "h-14 rounded-[12px] bg-gradient-to-br from-[#E8E4FF] to-white",
                "border border-[var(--color-accent-lavender)]/40 text-left px-3",
                "hover:from-[#DAD4FF] disabled:cursor-not-allowed disabled:opacity-40 transition-all",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-[var(--color-accent-lavender)]" strokeWidth={1.5} />
                <span className="font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
                  数 字 起 卦
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--color-ink-fade)]">一 / 二 / 三 个 数</p>
            </button>
          </div>
        )}

        {picked === "number" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {[
                { v: n1, set: setN1, ph: "1" },
                { v: n2, set: setN2, ph: "2" },
                { v: n3, set: setN3, ph: "3" },
              ].map((it, i) => (
                <input
                  key={i}
                  type="number"
                  inputMode="numeric"
                  value={it.v}
                  disabled={busy}
                  onChange={(e) => it.set(e.target.value)}
                  placeholder={it.ph}
                  className={cn(
                    "h-14 w-14 rounded-[12px] bg-white/60 px-2 text-center",
                    "border border-[var(--color-accent-lavender)]/40",
                    "font-[family-name:var(--font-serif)] text-[22px] text-[var(--color-ink-plum)]",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]",
                  )}
                />
              ))}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setPicked(null)}
                disabled={busy}
                className="text-xs text-[var(--color-ink-fade)] hover:text-[var(--color-ink-plum)]"
              >
                ←
              </button>
            </div>
            <button
              type="button"
              onClick={submitNumber}
              disabled={busy || ![n1, n2, n3].some((v) => v.trim())}
              className={cn(
                "h-12 w-full rounded-[12px] transition-all",
                "bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] text-white shadow-pill",
                "font-[family-name:var(--font-serif)] text-sm tracking-ritual",
                "hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {busy ? "起 卦 中…" : "起 卦"}
            </button>
          </div>
        )}

        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-3 gap-1.5">
            {SOON.map((label) => (
              <div
                key={label}
                className={cn(
                  "rounded-full border border-dashed py-1 text-center",
                  "border-[var(--color-accent-lavender)]/30 text-[10px] text-[var(--color-ink-fade)]",
                )}
              >
                {label}
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
            V 1.0.5 敬 请 期 待 <Sparkle size={8} />
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
