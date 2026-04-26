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
 * 消息列表 + 自动滚到底
 *
 * - messages 已存的消息
 * - streamingText 当前流式 chunk 的累积文本（null = 不显示流式气泡）
 * - empty 空态自定义内容
 * - onCardPick / onCardSubmit / busy 透传给 MessageBubble，让卡片回调走 ChatWindow
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
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamingText]);

  const isEmpty = messages.length === 0 && streamingText === null;

  return (
    <div className={cn("flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4", className)}>
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
