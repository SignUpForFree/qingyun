"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { Database } from "@/types/database";
import type { Intent } from "@/types/domain";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type DisplayMessage = Pick<Message, "id" | "role" | "content" | "created_at">;

interface ChatWindowProps {
  conversationId: string | null;
  initialMessages: DisplayMessage[];
  intentHint?: Intent;
  /** 从 /chat?initial=xxx 跳过来时自动发送的首条消息 */
  autoSendText?: string;
}

/**
 * 客户端聊天主体
 *
 * - 持有消息列表 + 流式 chunk
 * - send(text) → POST /api/chat (SSE)，逐字累加 streaming，结束后并入 messages
 * - 第一次发消息时 SSE 返回 meta event 携带 conversationId，replace 路由到 /chat/<id>
 * - autoSendText 仅在首挂载时发一次（autoSentRef 防重复）
 */
export function ChatWindow({
  conversationId: initialConvId,
  initialMessages,
  intentHint,
  autoSendText,
}: ChatWindowProps) {
  const router = useRouter();
  const [convId, setConvId] = React.useState<string | null>(initialConvId);
  const [messages, setMessages] = React.useState<DisplayMessage[]>(initialMessages);
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const autoSentRef = React.useRef(false);
  const sendRef = React.useRef<(t: string) => Promise<void>>(() => Promise.resolve());

  const send = React.useCallback(
    async (text: string) => {
      if (streaming !== null) return; // 正在流式时禁止再发
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const userMsg: DisplayMessage = {
        id: `tmp-user-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);
      setStreaming("");

      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, text, intentHint }),
          signal: abortRef.current.signal,
        });
      } catch (e) {
        toast.error(`网络异常：${e instanceof Error ? e.message : "请稍后再试"}`);
        setStreaming(null);
        return;
      }

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        toast.error(`AI 暂时无响应 (${res.status})${errBody ? "：" + errBody.slice(0, 80) : ""}`);
        setStreaming(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let finalConvId: string | null = convId;

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const parsed = parseSseFrame(evt);
            if (!parsed) continue;
            if (parsed.event === "meta") {
              const data = parsed.data as { conversationId?: string };
              if (data?.conversationId) {
                finalConvId = data.conversationId;
                if (!convId) {
                  setConvId(data.conversationId);
                  router.replace(`/chat/${data.conversationId}`);
                }
              }
            } else if (parsed.event === "token") {
              const chunk = typeof parsed.data === "string" ? parsed.data : "";
              assistantText += chunk;
              setStreaming(assistantText);
            } else if (parsed.event === "error") {
              toast.error(typeof parsed.data === "string" ? parsed.data : "AI 出错");
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          toast.error("流式中断，请重新发送");
        }
      }

      setMessages((m) => [
        ...m,
        {
          id: `tmp-asst-${Date.now()}`,
          role: "assistant",
          content: assistantText || "(无内容)",
          created_at: new Date().toISOString(),
        },
      ]);
      setStreaming(null);
      void finalConvId; // ESLint useless 但保留语义
    },
    [convId, router, streaming, intentHint],
  );

  sendRef.current = send;

  React.useEffect(() => {
    if (autoSendText && !autoSentRef.current) {
      autoSentRef.current = true;
      void sendRef.current(autoSendText);
    }
  }, [autoSendText]);

  // 卸载时打断进行中的请求
  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <MessageList messages={messages} streamingText={streaming} />
      <ChatInput onSend={send} busy={streaming !== null} />
    </div>
  );
}

interface SseFrame {
  event: string;
  data: unknown;
}

function parseSseFrame(raw: string): SseFrame | null {
  const lines = raw.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return { event, data: "" };
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}
