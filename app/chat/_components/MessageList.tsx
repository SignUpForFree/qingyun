"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MessageBubble } from "./MessageBubble";
import type { Database } from "@/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"];

interface MessageListProps {
  messages: Pick<Message, "id" | "role" | "content" | "created_at">[];
  streamingText: string | null;
  className?: string;
  empty?: React.ReactNode;
}

/**
 * 消息列表 + 自动滚到底
 *
 * - messages 已存的消息
 * - streamingText 当前流式 chunk 的累积文本（null = 不显示流式气泡）
 * - empty 空态自定义内容（招呼页用 QuickActions 等）
 */
export function MessageList({ messages, streamingText, className, empty }: MessageListProps) {
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
            <MessageBubble key={m.id} message={m} />
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
