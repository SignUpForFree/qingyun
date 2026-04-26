"use client";

import * as React from "react";
import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  DREAM_EMOTIONS,
  type DreamEmotion,
} from "@/lib/divination/dream-parser";

interface DreamLauncherProps {
  onSubmit: (input: { dreamText: string; emotion?: DreamEmotion }) => void | Promise<void>;
  busy?: boolean;
}

/**
 * 解梦输入栏（spec §5 解梦）
 *
 * - 顶部 emotion chip 5 选 1（可选；默认不选 = AI 自行推断）
 * - 中段 textarea（10–2000 字，描述梦境）
 * - 底部 解梦按钮（淡蓝渐变，跟水五行呼应）
 * - busy 时禁用并改文案
 */
export function DreamLauncher({ onSubmit, busy }: DreamLauncherProps) {
  const [emotion, setEmotion] = React.useState<DreamEmotion | null>(null);
  const [dreamText, setDreamText] = React.useState("");

  const charCount = dreamText.trim().length;
  const tooShort = charCount > 0 && charCount < 10;
  const canSubmit = !busy && charCount >= 10 && charCount <= 2000;

  function submit() {
    if (!canSubmit) return;
    void onSubmit({
      dreamText: dreamText.trim(),
      emotion: emotion ?? undefined,
    });
    setDreamText("");
    setEmotion(null);
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
        <span className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)] self-center">
          醒来时
        </span>
        {DREAM_EMOTIONS.map((e) => {
          const active = e === emotion;
          return (
            <button
              key={e}
              type="button"
              disabled={busy}
              onClick={() => setEmotion(active ? null : e)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3 py-1 text-xs tracking-ritual2 transition-all",
                "border border-[var(--color-accent-lavender)]/40",
                active
                  ? "bg-gradient-to-br from-[#A4B8E8]/60 to-[#C9A1D9]/60 text-[var(--color-ink-plum)]"
                  : "bg-white/40 text-[var(--color-ink-mist)] hover:bg-white/60",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {e}
            </button>
          );
        })}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          rows={3}
          value={dreamText}
          disabled={busy}
          placeholder={busy ? "解梦中…" : "把昨夜的梦讲给我听（10–2000 字）…"}
          onChange={(e) => setDreamText(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn(
            "min-h-16 max-h-32 resize-none rounded-[16px] bg-white/40 px-4 py-2",
            "text-sm font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
            "placeholder:text-[var(--color-ink-fade)]",
            "focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]",
          )}
        />
        <button
          type="button"
          aria-label="解梦"
          onClick={submit}
          disabled={!canSubmit}
          className={cn(
            "flex h-12 shrink-0 items-center justify-center gap-1 rounded-full px-4 transition-all",
            "bg-gradient-to-br from-[#A4B8E8] to-[#C9A1D9] text-white shadow-pill",
            "hover:opacity-90 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Moon className="h-4 w-4" />
          <span className="text-sm tracking-ritual">{busy ? "解梦…" : "解梦"}</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          {emotion ? `贴合『${emotion}』的感受去解读` : "AI 会从梦境推断主导情绪"}
        </p>
        <span
          className={cn(
            "text-[10px]",
            tooShort
              ? "text-[var(--color-wuxing-fire)]"
              : "text-[var(--color-ink-fade)]",
          )}
        >
          {charCount} / 2000
        </span>
      </div>
    </div>
  );
}
