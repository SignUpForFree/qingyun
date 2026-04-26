"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const DIMENSIONS = ["综合", "事业", "财运", "感情", "人际", "健康"] as const;
export type SlipDimension = (typeof DIMENSIONS)[number];

interface DivinationLauncherProps {
  onDraw: (input: { dimension: SlipDimension; question: string }) => void | Promise<void>;
  busy?: boolean;
}

/**
 * 抽签输入栏（spec §6 抽签 + §4 招呼页流程）
 *
 * - 顶部 6 个维度 chip 单选（默认 综合）
 * - 中段 textarea（多行，120 字以内）
 * - 底部 抽签按钮（淡紫粉渐变）
 * - busy 时禁用并改文案为『摇签中…』
 *
 * 当 intentHint === 'divination' 时替换 ChatInput 出现在底部
 */
export function DivinationLauncher({ onDraw, busy }: DivinationLauncherProps) {
  const [dimension, setDimension] = React.useState<SlipDimension>("综合");
  const [question, setQuestion] = React.useState("");

  function submit() {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    void onDraw({ dimension, question: trimmed });
    setQuestion("");
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
        {DIMENSIONS.map((d) => {
          const active = d === dimension;
          return (
            <button
              key={d}
              type="button"
              disabled={busy}
              onClick={() => setDimension(d)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3 py-1 text-xs tracking-ritual2 transition-all",
                "border border-[var(--color-accent-lavender)]/40",
                active
                  ? "bg-gradient-to-br from-[#F0B8C8]/60 to-[#C9A1D9]/60 text-[var(--color-ink-plum)]"
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
          placeholder={busy ? "摇签中…" : "心里默念一件事，写一两句…"}
          onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
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
          aria-label="抽签"
          onClick={submit}
          disabled={busy || !question.trim()}
          className={cn(
            "flex h-12 shrink-0 items-center justify-center gap-1 rounded-full px-4 transition-all",
            "bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] text-white shadow-pill",
            "hover:opacity-90 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm tracking-ritual">{busy ? "摇签…" : "抽签"}</span>
        </button>
      </div>

      <p className="px-1 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
        {DIMENSION_HINT[dimension]}
      </p>
    </div>
  );
}

const DIMENSION_HINT: Record<SlipDimension, string> = {
  综合: "看看眼下的整体气运",
  事业: "工作、学业、项目方向",
  财运: "进项、机会、投入产出",
  感情: "亲密、暧昧、家人之间",
  人际: "朋友、同事、合作关系",
  健康: "身心、作息、能量状态",
};
