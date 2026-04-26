"use client";

import * as React from "react";
import { Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, Sparkle } from "@/components/su";

interface Props {
  onSubmit: (waiying: string) => void | Promise<void>;
  onSkip: () => void;
  busy?: boolean;
}

/**
 * 梅花外应回填表单（spec §6.2 外应分支）
 *
 * 出现时机：上一条 assistant 是 ui:'meihua_reading' 且 waiying === null
 *
 * - textarea：用户填『起卦那一刻周围印象深刻的画面/声音/一句话』
 * - 提供按钮：触发 PATCH /api/divination/meihua → 二次解读
 * - 跳过按钮：本地 dismiss（不调 API；外应保持 null）
 */
export function MeihuaWaiyingForm({ onSubmit, onSkip, busy }: Props) {
  const [text, setText] = React.useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void onSubmit(trimmed);
    setText("");
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
        <div className="flex items-center gap-1.5">
          <Wind
            className="h-3.5 w-3.5 text-[var(--color-accent-lavender)]"
            strokeWidth={1.5}
          />
          <span className="font-[family-name:var(--font-serif)] text-[13px] tracking-ritual text-[var(--color-ink-plum)]">
            外 应 一 笔
          </span>
          <Sparkle size={9} className="ml-auto" />
        </div>

        <textarea
          rows={2}
          value={text}
          disabled={busy}
          placeholder={
            busy
              ? "融合外应中…"
              : "起卦那一刻周围有没有印象深刻的画面 / 声音 / 一句话？"
          }
          onChange={(e) => setText(e.target.value.slice(0, 200))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn(
            "min-h-12 max-h-24 w-full resize-none rounded-[12px] bg-white/40 px-3 py-2",
            "text-sm font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
            "placeholder:text-[var(--color-ink-fade)]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]",
          )}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className={cn(
              "h-10 flex-1 rounded-[12px] border border-[var(--color-accent-lavender)]/40",
              "bg-white/40 text-sm tracking-ritual text-[var(--color-ink-mist)]",
              "hover:bg-white/60 disabled:opacity-40",
            )}
          >
            跳 过
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className={cn(
              "h-10 flex-1 rounded-[12px] transition-all",
              "bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] text-white shadow-pill",
              "font-[family-name:var(--font-serif)] text-sm tracking-ritual",
              "hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {busy ? "融 合 中…" : "提 供 外 应"}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
