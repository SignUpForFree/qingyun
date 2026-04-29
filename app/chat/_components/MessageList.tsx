"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  MessageBubble,
  type DisplayMessage,
  type CardPickCallback,
  type CardSubmitCallback,
  type CardActionCallback,
} from "./MessageBubble";

interface MessageListProps {
  messages: DisplayMessage[];
  streamingText: string | null;
  className?: string;
  empty?: React.ReactNode;
  onCardPick?: CardPickCallback;
  onCardSubmit?: CardSubmitCallback;
  onCardAction?: CardActionCallback;
  busy?: boolean;
  /** user 头像 URL（来自默认档案 avatar_url；null 时取首字 fallback） */
  userAvatarUrl?: string | null;
  /** user 昵称（avatar fallback + alt） */
  userNickname?: string;
}

/**
 * 消息列表 + 智能自动滚到底
 *
 * 之前的版本对每次 messages.length / streamingText 变化都 scrollIntoView
 * { behavior: "smooth" }，流式输出每帧 setState 时连发 smooth 滚动 →
 * 视觉上抖动追不上。修法：
 *
 * 1) IntersectionObserver 跟踪「底锚点是否在视口」→ 用户向上翻阅历史时
 *    isPinnedBottom=false，新消息不再强行把人拽到底
 * 2) 流式追加时用 behavior:"auto"（瞬时），仅消息边界（新一轮答复完成）
 *    才用 behavior:"smooth"
 * 3) 首次挂载用 behavior:"auto"，避免进入页面就看到从头滚到底的过场动画
 */
export function MessageList({
  messages,
  streamingText,
  className,
  empty,
  onCardPick,
  onCardSubmit,
  onCardAction,
  busy,
  userAvatarUrl,
  userNickname,
}: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const firstMountRef = React.useRef(true);

  /**
   * 是否"贴底" — 直接算 scrollTop 与底距，比 IntersectionObserver 的 rootMargin
   * 更稳（之前用负 rootMargin 导致 endRef 在底部时反而被判为 not-intersecting，
   * isPinned 永久 false，整套 auto-scroll 全部 skip）。
   *
   * 阈值 80px：用户主动向上滚 ≥80px 才视为"读旧消息中"，新内容不打扰。
   */
  function isPinnedToBottom(): boolean {
    const root = scrollRef.current;
    if (!root) return true;
    const dist = root.scrollHeight - root.scrollTop - root.clientHeight;
    return dist < 80;
  }

  // 流式期间：每次 streamingText 变化都"瞬时"贴底
  React.useEffect(() => {
    if (streamingText === null) return;
    if (!isPinnedToBottom()) return;
    endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [streamingText]);

  // 消息边界：messages.length 变化总是滚到底
  // 用户主动动作（输入框发送 / 点 chips / 点卡片选项）都会导致新消息出现，
  // 此时 UI 必须把视图带到最新内容，不受 isPinnedToBottom 约束（因为用户期望看到）。
  React.useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const isEmpty = messages.length === 0 && streamingText === null;

  return (
    <div
      ref={scrollRef}
      className={cn("flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4", className)}
    >
      {isEmpty ? (
        empty
      ) : (
        <>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onCardPick={onCardPick}
              onCardSubmit={onCardSubmit}
              onCardAction={onCardAction}
              busy={busy}
              userAvatarUrl={userAvatarUrl}
              userNickname={userNickname}
            />
          ))}
          {streamingText !== null && (
            <MessageBubble
              streaming
              message={{
                id: "__streaming__",
                role: "assistant",
                content: streamingText,
                created_at: new Date().toISOString(),
              }}
            />
          )}
        </>
      )}
      <div ref={endRef} aria-hidden />
    </div>
  );
}
