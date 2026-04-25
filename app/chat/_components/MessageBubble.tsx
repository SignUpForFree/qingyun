import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/su";
import type { Database } from "@/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"];

interface MessageBubbleProps {
  message: Pick<Message, "id" | "role" | "content" | "created_at">;
  streaming?: boolean;
  className?: string;
}

/**
 * 单条消息气泡（spec §4 Chat Session）
 *
 * - User: 右对齐 + 淡紫粉渐变 over glass + rounded-br-sm 切角
 * - Assistant: 左对齐 + glass + rounded-bl-sm 切角 + 头部 ✦ 身份标
 * - Streaming: 在尾部加细 lavender 竖线（不用 ▍ 粗块）
 */
export function MessageBubble({ message, streaming, className }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className={cn("text-center", className)}>
        <span className="rounded-full bg-white/40 px-3 py-1 text-xs text-[var(--color-ink-fade)]">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}>
      <div className="flex max-w-[82%] gap-2">
        {!isUser && (
          <div
            aria-hidden
            className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E8E4FF] to-[#FFE8F0]"
          >
            <Sparkle size={10} variant="diamond" />
          </div>
        )}
        <div
          className={cn(
            "relative whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-relaxed",
            "font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
            isUser
              ? "rounded-[18px] rounded-br-[4px] bg-gradient-to-br from-[#F0B8C8]/40 to-[#C9A1D9]/40 shadow-pill"
              : "glass hairline rounded-[18px] rounded-bl-[4px]",
          )}
        >
          {message.content}
          {streaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[var(--color-accent-lavender)] align-middle"
            />
          )}
        </div>
      </div>
    </div>
  );
}
