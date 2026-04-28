"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  MessageBubble,
  type DisplayMessage,
  type CardPickCallback,
  type CardSubmitCallback,
} from "./MessageBubble";

interface MessageListProps {
  messages: DisplayMessage[];
  streamingText: string | null;
  className?: string;
  empty?: React.ReactNode;
  onCardPick?: CardPickCallback;
  onCardSubmit?: CardSubmitCallback;
  busy?: boolean;
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
  busy,
}: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const isPinnedRef = React.useRef(true);
  const firstMountRef = React.useRef(true);

  // 监听底锚点是否在视口（用户向上翻 → false → 后续新消息不再追滚）
  // jsdom 没 IntersectionObserver，guard 一下保持 isPinned=true 兼容测试。
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const target = endRef.current;
    const root = scrollRef.current;
    if (!target || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) isPinnedRef.current = e.isIntersecting;
      },
      { root, rootMargin: "0px 0px -64px 0px", threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  // 流式期间：每次 streamingText 变化都"瞬时"贴底（仅当 isPinned=true）
  React.useEffect(() => {
    if (streamingText === null) return;
    if (!isPinnedRef.current) return;
    endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [streamingText]);

  // 消息边界：messages.length 变化（新一轮答复落定）→ 平滑滚到底
  React.useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      // 首次挂载：直接瞬时贴底，不滚动动画
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      return;
    }
    if (!isPinnedRef.current) return;
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
              busy={busy}
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
