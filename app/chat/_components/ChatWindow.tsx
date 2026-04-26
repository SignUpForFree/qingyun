"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { DivinationLauncher } from "./DivinationLauncher";
import { DreamLauncher } from "./DreamLauncher";
import { GlassCard, Sparkle } from "@/components/su";
import type { DisplayMessage } from "./MessageBubble";
import type { Intent } from "@/types/domain";
import type { DreamEmotion } from "@/lib/divination/dream-parser";

type SlipDimension = "综合" | "事业" | "财运" | "感情" | "人际" | "健康";

interface StructuredResponse {
  conversationId: string;
  userMessage: DisplayMessage;
  assistantMessage: DisplayMessage;
}

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

  const [structuredBusy, setStructuredBusy] = React.useState(false);

  const runStructured = React.useCallback(
    async (opts: {
      url: string;
      body: Record<string, unknown>;
      label: string;
    }): Promise<void> => {
      if (structuredBusy || streaming !== null) return;
      setStructuredBusy(true);

      let res: Response;
      try {
        res = await fetch(opts.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, ...opts.body }),
        });
      } catch (e) {
        toast.error(`${opts.label}失败：${e instanceof Error ? e.message : "网络异常"}`);
        setStructuredBusy(false);
        return;
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        toast.error(
          `${opts.label}失败 (${res.status})${errBody ? "：" + errBody.slice(0, 80) : ""}`,
        );
        setStructuredBusy(false);
        return;
      }

      let data: StructuredResponse;
      try {
        data = (await res.json()) as StructuredResponse;
      } catch {
        toast.error(`${opts.label}返回格式异常`);
        setStructuredBusy(false);
        return;
      }

      setMessages((m) => [...m, data.userMessage, data.assistantMessage]);
      if (!convId && data.conversationId) {
        setConvId(data.conversationId);
        router.replace(`/chat/${data.conversationId}`);
      }
      setStructuredBusy(false);
    },
    [convId, router, streaming, structuredBusy],
  );

  const runDivination = React.useCallback(
    ({ dimension, question }: { dimension: SlipDimension; question: string }) =>
      runStructured({
        url: "/api/divination/qianwen",
        body: { dimension, userQuestion: question },
        label: "抽签",
      }),
    [runStructured],
  );

  const runDream = React.useCallback(
    ({ dreamText, emotion }: { dreamText: string; emotion?: DreamEmotion }) =>
      runStructured({
        url: "/api/divination/dream",
        body: { dreamText, emotion },
        label: "解梦",
      }),
    [runStructured],
  );

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

  const isDivination = intentHint === "divination";
  const isDream = intentHint === "dream";

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <MessageList
        messages={messages}
        streamingText={streaming}
        empty={
          <div className="flex flex-1 items-center justify-center px-6">
            <GlassCard className="max-w-sm space-y-2 p-5 text-center">
              <p className="text-sm tracking-ritual2 text-[var(--color-ink-plum)]">
                {emptyHint(intentHint)} <Sparkle size={10} />
              </p>
              <p className="text-xs text-[var(--color-ink-fade)]">
                {bottomHint(intentHint)}
              </p>
            </GlassCard>
          </div>
        }
      />
      {isDivination ? (
        <DivinationLauncher onDraw={runDivination} busy={structuredBusy} />
      ) : isDream ? (
        <DreamLauncher onSubmit={runDream} busy={structuredBusy} />
      ) : (
        <ChatInput onSend={send} busy={streaming !== null} />
      )}
    </div>
  );
}

function bottomHint(intent: Intent | undefined): string {
  switch (intent) {
    case "divination":
      return "选个维度 + 写下心事，再点抽签";
    case "dream":
      return "梦境描述越具体，解读越贴";
    case "bazi":
      return "想看哪一段？工作 / 感情 / 健康都可以";
    case "meihua":
      return "起卦还在路上，先用对话页吧";
    default:
      return "想问就问，没什么忌讳";
  }
}

function emptyHint(intent: Intent | undefined): string {
  switch (intent) {
    case "divination":
      return "心里默念一件事，再说『开始』";
    case "dream":
      return "把昨夜的梦讲给我听";
    case "bazi":
      return "想问命盘里哪一段？";
    case "meihua":
      return "为眼下哪件事起卦？";
    default:
      return "今天，想聊点什么";
  }
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
