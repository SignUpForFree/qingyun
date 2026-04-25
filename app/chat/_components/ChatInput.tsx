"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** AI 正在回复中（spec §4 弱化输入区） */
  busy?: boolean;
}

/**
 * Chat 输入栏（spec §3 招呼页 / §4 会话页 通用）
 *
 * - 单行 textarea，Enter 发送 / Shift+Enter 换行
 * - busy=true 时输入禁用 + 浮 "AI 正在回应…"
 * - 不做路由/发送 — 纯受控组件，由父决定
 */
export function ChatInput({ onSend, disabled, placeholder, busy }: ChatInputProps) {
  const [text, setText] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // 简易自适应高度
  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  const finalPlaceholder = busy ? "AI 正在回应…" : placeholder ?? "把想问的写给我…";

  return (
    <div
      className={cn(
        "glass hairline sticky bottom-0 z-20 flex items-end gap-2 px-3 py-3",
        "border-t border-[var(--color-accent-lavender)]/30",
        busy && "opacity-70",
      )}
    >
      <Textarea
        ref={taRef}
        rows={1}
        value={text}
        disabled={disabled || busy}
        placeholder={finalPlaceholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className={cn(
          "min-h-10 max-h-32 resize-none rounded-[20px] bg-white/40 px-4 py-2",
          "text-sm font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
          "placeholder:text-[var(--color-ink-fade)]",
          "focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]",
        )}
      />
      <button
        type="button"
        aria-label="发送"
        onClick={submit}
        disabled={disabled || busy || !text.trim()}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
          "bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] text-white shadow-pill",
          "hover:opacity-90 active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
