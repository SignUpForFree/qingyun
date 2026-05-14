"use client";

import * as React from "react";

const INTENT_AUTO_TEXT: Record<string, string> = {
  divination: "我要抽灵签",
  dream: "我要解梦",
  bazi: "我要八字解读",
  meihua: "我要测算",
};

interface UseMountActionsOptions {
  send: (text: string) => Promise<void>;
  autoSendText?: string;
  initialIntent?: "divination" | "dream" | "bazi" | "meihua" | null;
}

/**
 * mount 时的一次性副作用：
 * - autoSendText（来自 /chat?initial=...）→ 自动 send
 * - initialIntent（来自 /chat?intent=...）→ send(对应预设话术)
 *
 * 用 ref 锁，避免 send 引用变化或 React.StrictMode 双 mount 重复触发。
 */
export function useMountActions({
  send,
  autoSendText,
  initialIntent,
}: UseMountActionsOptions): void {
  const sentRef = React.useRef(false);
  const sendRef = React.useRef(send);
  React.useEffect(() => {
    sendRef.current = send;
  }, [send]);

  React.useEffect(() => {
    if (sentRef.current) return;
    if (autoSendText) {
      sentRef.current = true;
      void sendRef.current(autoSendText);
      return;
    }
    if (initialIntent && INTENT_AUTO_TEXT[initialIntent]) {
      sentRef.current = true;
      void sendRef.current(INTENT_AUTO_TEXT[initialIntent]);
    }
  }, [autoSendText, initialIntent]);
}
