"use client";

import * as React from "react";
import { Send, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useVisualViewportInset } from "@/lib/util/use-visual-viewport-inset";
import { IntentChips } from "./IntentChips";
import { isSpeechRecognitionSupported, startRecording } from "@/lib/speech/asr";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** AI 正在回复中（spec §4 弱化输入区） */
  busy?: boolean;
  /** 显示意图 chip 行（M2.25, 招呼页 / 空对话页用） */
  showQuickChips?: boolean;
  /** M4.10 ?prefill= 预填初始文本（不自动 send，让用户改后再发） */
  initialText?: string;
  /** 实色背景（chat 主页用 — 透明状态下看不清气泡的边界） */
  solid?: boolean;
  /** SSE 进度提示，挂在 chips 上方一并 sticky */
  progressHint?: string | null;
}

/**
 * Chat 输入栏（spec §3 招呼页 / §4 会话页 通用）
 *
 * - 单行 textarea，Enter 发送 / Shift+Enter 换行
 * - 🎤 麦克风按钮：按住录音 → ASR → 自动填入文本
 * - busy=true 时输入禁用 + 浮 "AI 正在回应…"
 * - showQuickChips: 在输入框上方挂 4 个意图 chip（抽签 / 测算 / 解梦 / 八字）
 *   chip 点击直接 onSend(预设话术)，触发关键词层路由（0 token，spec §4.2）
 * - 不做路由/发送 — 纯受控组件，由父决定
 */
export function ChatInput({
  onSend,
  disabled,
  placeholder,
  busy,
  showQuickChips,
  initialText,
  solid,
  progressHint,
}: ChatInputProps) {
  const [text, setText] = React.useState(initialText ?? "");
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const keyboardInset = useVisualViewportInset();

  // 语音录制状态
  const [isRecording, setIsRecording] = React.useState(false);
  const [interimText, setInterimText] = React.useState("");
  // 仅在客户端 mount 后检测，避免 SSR 无 window → false、浏览器 → true 导致 hydration mismatch
  const [hasSpeechSupport, setHasSpeechSupport] = React.useState(false);
  React.useEffect(() => {
    setHasSpeechSupport(isSpeechRecognitionSupported());
  }, []);

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

  const handleChipPick = React.useCallback(
    (chipText: string) => {
      if (busy || disabled) return;
      onSend(chipText);
    },
    [busy, disabled, onSend],
  );

  const handleMicClick = React.useCallback(async () => {
    if (isRecording) return; // 防重复
    setIsRecording(true);
    setInterimText("");
    try {
      const transcript = await startRecording({
        lang: "zh-CN",
        onInterim: (t) => setInterimText(t),
      });
      if (transcript.trim()) {
        setText((prev) => {
          const joined = prev ? `${prev}${transcript}` : transcript;
          return joined;
        });
      }
    } catch (e) {
      // 用户取消或浏览器不支持，静默处理
      if (process.env.NODE_ENV !== "production") {
        console.warn("[ChatInput] ASR error:", e);
      }
    } finally {
      setIsRecording(false);
      setInterimText("");
    }
  }, [isRecording]);

  const finalPlaceholder = busy
    ? "AI 正在回应…"
    : isRecording
      ? "正在聆听…"
      : placeholder ?? "把想问的写给我…";

  return (
    <div
      className={cn(
        "shrink-0 flex flex-col gap-0 px-0 py-0",
        "border-t border-[var(--color-accent-lavender)]/30",
        "pb-[env(safe-area-inset-bottom,0px)]",
        solid
          ? "bg-[var(--color-bg-paper)]"
          : "glass hairline",
        busy && "opacity-70",
      )}
      style={keyboardInset > 0 ? { transform: `translateY(-${keyboardInset}px)` } : undefined}
    >
      {progressHint && (
        <p
          aria-live="polite"
          data-testid="progress-hint"
          className="px-4 pt-1 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]"
        >
          {progressHint}
        </p>
      )}
      {showQuickChips && <IntentChips onPick={handleChipPick} busy={busy} />}
      <div className="relative flex items-end gap-2 px-3 pb-3 pt-1">
        <div className="flex-1">
        <Textarea
          ref={taRef}
          rows={1}
          value={isRecording && interimText ? interimText : text}
          disabled={disabled || busy || isRecording}
          placeholder={finalPlaceholder}
          onChange={(e) => {
              const v = e.target.value;
              setText(v.length > 1000 ? v.slice(0, 1000) : v);
            }}
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
            isRecording && "ring-2 ring-red-400/50",
          )}
        />
        {text.length > 900 && (
          <p className={cn(
            "mt-0.5 text-[10px] text-right pr-1",
            text.length >= 1000 ? "text-red-400" : "text-[var(--color-ink-fade)]",
          )}>
            {text.length}/1000
          </p>
        )}
        </div>
        {/* 🎤 麦克风按钮 */}
        {hasSpeechSupport && (
          <button
            type="button"
            aria-label={isRecording ? "正在录音" : "语音输入"}
            onClick={handleMicClick}
            disabled={disabled || busy}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
              isRecording
                ? "bg-red-400/80 text-white animate-pulse"
                : "bg-white/40 text-[var(--color-ink-plum)] hover:bg-white/60",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
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
    </div>
  );
}
