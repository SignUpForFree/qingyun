"use client";

import * as React from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { HistoryDrawer } from "./HistoryDrawer";
import { EmptyLauncher } from "./EmptyLauncher";
import type { DisplayMessage } from "./MessageBubble";
import { useChatStream } from "./use-chat-stream";
import { useCardHandlers } from "./use-card-handlers";
import { useMountActions } from "./use-mount-actions";
import { useDevSessionBootstrap } from "./use-dev-session-bootstrap";

interface ChatWindowProps {
  conversationId: string | null;
  initialMessages: DisplayMessage[];
  /** 从 /chat?initial=xxx 跳过来时自动发送的首条消息 */
  autoSendText?: string;
  /** ?intent=divination|dream|bazi|meihua → mount 时自动发送对应预设话术（M2.24, spec §4.2） */
  initialIntent?: "divination" | "dream" | "bazi" | "meihua" | null;
  /** ?open=history → mount 时打开历史抽屉（M2.24） */
  openHistoryOnMount?: boolean;
  /** ?prefill=xxx → 预填到输入框（不自动发送，M4.10 / DeepAskButton 入口） */
  prefillText?: string;
  /** 当前用户默认档案头像 URL（user 气泡左侧显示） */
  userAvatarUrl?: string | null;
  /** 当前用户默认档案昵称（avatar fallback 取首字 + 无障碍 alt） */
  userNickname?: string;
  /** dev 无 cookie 时先 /api/dev-login 再 auto-send */
  needsDevBootstrap?: boolean;
}

/**
 * 客户端聊天主体（V1.0 文档对齐版）
 *
 * 状态机分散在三个 hook：
 * - useChatStream：/api/chat 主流 + sub-action SSE 状态机（messages/streaming/busy/convId）
 * - useCardHandlers：picker/form/action 卡片回调
 * - useMountActions：autoSendText / initialIntent 一次性触发
 *
 * 本组件只做 props 转发 + 顶层容器渲染。
 */
export function ChatWindow({
  conversationId,
  initialMessages,
  autoSendText,
  initialIntent,
  openHistoryOnMount,
  prefillText,
  userAvatarUrl,
  userNickname,
  needsDevBootstrap = false,
}: ChatWindowProps) {
  const sessionReady = useDevSessionBootstrap(needsDevBootstrap);

  const stream = useChatStream({
    initialConvId: conversationId,
    initialMessages,
    sessionReady: !needsDevBootstrap || sessionReady,
    forcedIntent: initialIntent ?? null,
  });

  const { handleCardPick, handleCardSubmit, handleCardAction } = useCardHandlers({
    convId: stream.convId,
    messages: stream.messages,
    setMessages: stream.setMessages,
    postSubAction: stream.postSubAction,
    markDreamFastWaiting: stream.markDreamFastWaiting,
    clearDreamFastWaiting: stream.clearDreamFastWaiting,
  });

  useMountActions({
    send: stream.send,
    autoSendText: sessionReady ? autoSendText : undefined,
    initialIntent: sessionReady ? initialIntent : null,
  });

  const drawer = useHistoryDrawer(Boolean(openHistoryOnMount));
  const sessionBlocked = needsDevBootstrap && !sessionReady;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] z-40">
        <HistoryDrawer
          currentId={stream.convId ?? undefined}
          open={drawer.open}
          onOpenChange={drawer.setOpen}
        />
      </div>
      <MessageList
        messages={stream.messages}
        streamingText={stream.streamingText}
        streamingSlipReport={stream.streamingSlipReport}
        streamingMeihuaMessageId={stream.streamingMeihuaMessageId}
        streamingBaziMessageId={stream.streamingBaziMessageId}
        streamingDreamMessageId={stream.streamingDreamMessageId}
        onCardPick={handleCardPick}
        onCardSubmit={handleCardSubmit}
        onCardAction={handleCardAction}
        busy={stream.busy}
        userAvatarUrl={userAvatarUrl}
        userNickname={userNickname}
        empty={<EmptyLauncher onPick={stream.send} busy={sessionBlocked || stream.isGenerating} />}
      />
      <ChatInput
        onSend={stream.send}
        disabled={sessionBlocked}
        generating={stream.isGenerating}
        onStop={stream.stopGeneration}
        initialText={prefillText}
        showQuickChips={stream.messages.length > 0}
        solid
        progressHint={stream.progressHint}
        placeholder="把想问的写给我…"
      />
    </div>
  );
}

/**
 * 受控历史抽屉 + 焦点恢复。
 * 抽屉关闭时把焦点恢复到打开它的元素（避免 a11y 焦点丢失）。
 */
function useHistoryDrawer(initialOpen: boolean) {
  const [open, setOpenRaw] = React.useState<boolean>(initialOpen);
  const prevFocusRef = React.useRef<HTMLElement | null>(null);
  const setOpen = React.useCallback((next: boolean) => {
    if (next) {
      prevFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    } else if (prevFocusRef.current) {
      const target = prevFocusRef.current;
      // requestAnimationFrame 让 Radix close transition 跑完再 focus
      requestAnimationFrame(() => target.focus());
      prevFocusRef.current = null;
    }
    setOpenRaw(next);
  }, []);
  return { open, setOpen };
}
