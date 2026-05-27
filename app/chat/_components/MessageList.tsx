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
import { SlipReportCard } from "./cards/SlipReportCard";
import { StreamingReadingCard } from "./cards/StreamingReadingCard";
import type { StreamingSlipReport } from "./streaming-slip-report";
import type { SlipImageLevel } from "./cards/SlipImageFullscreen";

/** 距底部小于此值视为「贴底」，才自动滚（用户上滑看历史时不抢滚动） */
const PIN_THRESHOLD_PX = 96;

interface MessageListProps {
  messages: DisplayMessage[];
  streamingText: string | null;
  streamingSlipReport?: StreamingSlipReport | null;
  streamingMeihuaMessageId?: string | null;
  className?: string;
  empty?: React.ReactNode;
  onCardPick?: CardPickCallback;
  onCardSubmit?: CardSubmitCallback;
  onCardAction?: CardActionCallback;
  busy?: boolean;
  userAvatarUrl?: string | null;
  userNickname?: string;
}

/** 用于触发滚底：长度变化、同条消息合并/卡片阶段更新 */
export function buildScrollAnchorKey(messages: DisplayMessage[]): string {
  if (messages.length === 0) return "empty";
  const tail = messages.slice(-5);
  return `${messages.length}|${tail
    .map((m) => `${m.id}:${m.role}:${(m.content ?? "").length}:${m.metadata ?? ""}`)
    .join("|")}`;
}

export function isScrollPinnedToBottom(root: HTMLElement | null): boolean {
  if (!root) return true;
  const dist = root.scrollHeight - root.scrollTop - root.clientHeight;
  return dist <= PIN_THRESHOLD_PX;
}

/** 将列表容器滚到最底 */
export function scrollContainerToBottom(
  root: HTMLElement | null,
  behavior: ScrollBehavior = "auto",
): void {
  if (!root) return;
  const top = Math.max(0, root.scrollHeight - root.clientHeight);
  if (behavior === "auto") {
    root.scrollTop = top;
    return;
  }
  root.scrollTo({ top, behavior });
}

/** 布局稳定前连打几次贴底 */
export function scheduleScrollToBottom(
  root: HTMLElement | null,
  behavior: ScrollBehavior = "auto",
): () => void {
  const run = () => scrollContainerToBottom(root, behavior);
  run();
  const raf = requestAnimationFrame(run);
  const t1 = window.setTimeout(run, 50);
  const t2 = window.setTimeout(run, 180);
  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(t1);
    window.clearTimeout(t2);
  };
}

/**
 * 消息列表：可上下滑动；新消息时贴底，用户上滑阅读时不抢滚动
 */
export function MessageList({
  messages,
  streamingText,
  streamingSlipReport = null,
  streamingMeihuaMessageId = null,
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
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const pinnedRef = React.useRef(true);
  const prevAnchorKeyRef = React.useRef<string>("");

  const scrollAnchorKey = React.useMemo(
    () => buildScrollAnchorKey(messages),
    [messages],
  );

  const refreshPinned = React.useCallback(() => {
    pinnedRef.current = isScrollPinnedToBottom(scrollRef.current);
  }, []);

  const stickToBottom = React.useCallback((behavior: ScrollBehavior = "auto") => {
    scrollContainerToBottom(scrollRef.current, behavior);
    pinnedRef.current = true;
  }, []);

  const stickIfPinned = React.useCallback((behavior: ScrollBehavior = "auto") => {
    refreshPinned();
    if (pinnedRef.current) stickToBottom(behavior);
  }, [refreshPinned, stickToBottom]);

  // 新消息 / 卡片更新：强制贴底
  React.useLayoutEffect(() => {
    const isNew = scrollAnchorKey !== prevAnchorKeyRef.current;
    prevAnchorKeyRef.current = scrollAnchorKey;
    if (!isNew) return;
    return scheduleScrollToBottom(scrollRef.current, "auto");
  }, [scrollAnchorKey]);

  // 流式：仅贴底时跟随
  React.useLayoutEffect(() => {
    if (streamingText === null && streamingSlipReport === null) return;
    stickIfPinned("auto");
    const t = window.setTimeout(() => stickIfPinned("auto"), 50);
    return () => window.clearTimeout(t);
  }, [streamingText, streamingSlipReport, stickIfPinned]);

  // 抽签动效撑高：仅贴底时跟随（避免用户上滑时被拽回）
  React.useEffect(() => {
    const root = scrollRef.current;
    const content = contentRef.current;
    if (!root || !content || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) scrollContainerToBottom(root, "auto");
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const isEmpty =
    messages.length === 0 && streamingText === null && streamingSlipReport === null;

  return (
    <div
      ref={scrollRef}
      onScroll={refreshPinned}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
        "touch-pan-y [-webkit-overflow-scrolling:touch]",
        className,
      )}
      data-testid="message-list-scroll"
    >
      <div
        ref={contentRef}
        className={cn(
          "flex flex-col gap-3 px-4 py-4",
          "pb-8",
        )}
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
                streamingMeihuaMessageId={streamingMeihuaMessageId}
                userAvatarUrl={userAvatarUrl}
                userNickname={userNickname}
              />
            ))}
            {streamingSlipReport !== null && (
              <SlipReportCard
                slipNumber={streamingSlipReport.slipNumber}
                level={streamingSlipReport.level as SlipImageLevel}
                title={streamingSlipReport.title}
                poem={streamingSlipReport.poem}
                dimension={streamingSlipReport.dimension}
                reading={streamingSlipReport.reading}
                aiInterpretation={streamingSlipReport.aiInterpretation}
                sections={streamingSlipReport.sections}
                isFullInterpret={streamingSlipReport.isFullInterpret}
                streaming
              />
            )}
            {streamingText !== null &&
              streamingSlipReport === null &&
              streamingMeihuaMessageId === null && (
                <StreamingReadingCard text={streamingText} />
              )}
          </>
        )}
        <div aria-hidden className="h-1 shrink-0" data-testid="message-list-end" />
      </div>
    </div>
  );
}
