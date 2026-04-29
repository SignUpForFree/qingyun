"use client";
import { cn } from "@/lib/utils";

interface IntentChipsProps {
  onPick: (text: string) => void;
  busy?: boolean;
  className?: string;
}

const CHIPS = [
  { label: "抽灵签", text: "我要抽灵签" },
  { label: "测算", text: "我要测算" },
  { label: "AI 解梦", text: "我要 AI 解梦" },
  { label: "八字解读", text: "我要八字解读" },
] as const;

/**
 * 意图 chip 行（spec §5.5 / 文档底部固定 4 入口）
 *
 * 点击发送固定话术，触发关键词层 classifyByKeyword 命中（0 token 路由）。
 */
export function IntentChips({ onPick, busy, className }: IntentChipsProps) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto px-3 pb-0 pt-1",
        className,
      )}
    >
      {CHIPS.map((c) => (
        <button
          key={c.label}
          type="button"
          disabled={busy}
          onClick={() => !busy && onPick(c.text)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs tracking-ritual2 transition-colors",
            "border-[var(--color-accent-lavender)]/40 bg-white/40 text-[var(--color-ink-plum)]",
            "hover:bg-[var(--color-accent-lavender)]/20",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
