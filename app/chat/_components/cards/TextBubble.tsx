import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/su";
import type { DisplayMessage } from "../MessageBubble";

interface TextBubbleProps {
  message: DisplayMessage;
  streaming?: boolean;
  isUser: boolean;
  className?: string;
  /** user 头像 URL（来自默认档案 avatar_url） */
  userAvatarUrl?: string | null;
  /** user 昵称（avatar fallback + alt） */
  userNickname?: string;
}

/**
 * 纯文本气泡 — user / assistant 共用
 *
 * - user：右对齐、玫瑰渐变实色 + 默认档案头像（左侧 reverse 后视觉靠右）
 * - assistant：左对齐、glass + brand Sparkle（暂未支持自定义头像）
 * - streaming=true 时尾追闪烁 ✦（spec §4.5）
 */
export function TextBubble({
  message,
  streaming,
  isUser,
  className,
  userAvatarUrl,
  userNickname,
}: TextBubbleProps) {
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}>
      <div className={cn("flex max-w-[82%] gap-2", isUser && "flex-row-reverse")}>
        {isUser ? (
          <UserAvatar url={userAvatarUrl ?? null} nickname={userNickname ?? "我"} />
        ) : (
          <AssistantAvatar />
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
              className={cn(
                "ml-1 inline-flex h-3.5 w-3.5 translate-y-[1px] items-center justify-center align-middle",
                "animate-pulse text-[13px] leading-none text-[var(--color-accent-lavender)]",
              )}
            >
              ✦
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * user 气泡左侧头像 — 有 avatar_url 用图，否则首字 fallback。
 * 复用 ProfileCardList 的同款样式，保持视觉一致。
 */
function UserAvatar({ url, nickname }: { url: string | null; nickname: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={nickname}
        className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = nickname.slice(0, 1) || "我";
  return (
    <div
      aria-label={nickname}
      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-lavender)]/30 font-[family-name:var(--font-serif)] text-[12px] text-[var(--color-ink-plum)]"
    >
      {initial}
    </div>
  );
}

/** 轻运 brand 头像（assistant 气泡左侧） */
function AssistantAvatar() {
  return (
    <div
      aria-hidden
      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E8E4FF] to-[#FFE8F0]"
    >
      <Sparkle size={10} variant="diamond" />
    </div>
  );
}

/** 卡片公共外框（左对齐，留 8% 给右边气泡呼吸） */
export function CardWrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div className="w-full max-w-[92%]">{children}</div>
    </div>
  );
}
