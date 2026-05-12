"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/util/api-fetch";
import {
  consumeSseStream,
  progressStageLabel,
  type SseCardData,
  type SseCallbacks,
} from "@/lib/chat/sse-client";
import {
  consumeStreamChunk,
  createStreamThinkState,
  flushStreamThinkState,
  stripThinkChain,
} from "@/lib/ai/strip-think-chain";
import type { DisplayMessage } from "./MessageBubble";

interface SubActionJsonResponse {
  step: string;
  card?: {
    id?: string;
    role: "assistant";
    content: string;
    metadata?: string | null;
  };
  conversationId?: string;
  profileId?: string;
}

interface UseChatStreamOptions {
  initialConvId: string | null;
  initialMessages: DisplayMessage[];
}

export interface UseChatStreamReturn {
  convId: string | null;
  messages: DisplayMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  streamingText: string | null;
  progressHint: string | null;
  busy: boolean;
  send: (text: string) => Promise<void>;
  postSubAction: (
    url: string,
    label: string,
    body: Record<string, unknown>,
  ) => Promise<void>;
  /** dream fast：标记下一条用户消息走 /api/divination/dream 而不是 /api/chat */
  markDreamFastWaiting: () => void;
}

/**
 * ChatWindow 的核心 SSE 状态机
 *
 * 责任：
 * - send(text)：走 /api/chat，处理 meta + token(RAF 节流) + card + progress + done + error
 * - postSubAction(url, label, body)：sub-action 路由的 JSON 卡（Branch A/B/C）或 SSE（Branch D）
 * - convId 自动从 meta 事件提取
 *
 * 关于会话切换：
 * - 新会话首发后只用 `history.replaceState` 改 URL，不调 router.replace —— 避免触发
 *   Next.js Server Component 重新渲染 + 把空的 initialMessages 推下来覆盖本地 state
 * - 切换到已有会话由 ChatPage 给 <ChatWindow key={cid}> 完成，整组件重挂
 */
export function useChatStream({
  initialConvId,
  initialMessages,
}: UseChatStreamOptions): UseChatStreamReturn {
  const [convId, setConvId] = React.useState<string | null>(initialConvId);
  const [messages, setMessages] = React.useState<DisplayMessage[]>(initialMessages);
  const [streamingText, setStreamingText] = React.useState<string | null>(null);
  const [progressHint, setProgressHint] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const dreamFastWaitingRef = React.useRef(false);

  // 注意：不要在 unmount 时主动 abort 进行中的 fetch。
  // React 18+ StrictMode 下 dev 双跑（mount → cleanup → mount）会把第一次 mount
  // 期间 useMountActions 触发的 send 杀掉，第二次 mount 又被 sentRef 锁住跳过 send，
  // 用户看到「点了没反应 + AbortError: signal is aborted without reason」。
  // 真要取消请求由 send 内部「新请求覆盖旧请求」处理；用户关页/导航走 = 浏览器自动断流。

  const markDreamFastWaiting = React.useCallback(() => {
    dreamFastWaitingRef.current = true;
  }, []);

  /**
   * 共享的 SSE 流消费 — token RAF 节流 + cards 收集 + progress label。
   * send 和 postSubAction 都用它，差别仅在 onMeta 钩子（仅 send 处理 conversationId）。
   */
  const consumeStream = React.useCallback(
    async (
      body: ReadableStream<Uint8Array>,
      label: string,
      extra: Pick<SseCallbacks, "onMeta">,
    ): Promise<{ assistantText: string; cards: DisplayMessage[] }> => {
      let assistantText = "";
      const cards: DisplayMessage[] = [];
      let rafId: number | null = null;
      // 跨 chunk 拼半截 <think> 也能识别，UI 上完全不会闪现思考链
      const thinkState = createStreamThinkState();
      const flush = () => {
        rafId = null;
        setStreamingText(assistantText);
      };
      const sched = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(flush);
      };

      try {
        await consumeSseStream(body, {
          ...extra,
          onToken: (chunk) => {
            const visible = consumeStreamChunk(thinkState, chunk);
            if (visible) {
              assistantText += visible;
              sched();
            }
          },
          onCard: (card) => cards.push(toDisplayCard(card)),
          onProgress: (data) => {
            const stage = String(data.stage ?? "");
            const pct = typeof data.percent === "number" ? data.percent : 0;
            setProgressHint(stage ? `${progressStageLabel(stage)} ${pct}%` : null);
          },
          onDone: () => setProgressHint(null),
          onError: (msg) => toast.error(msg || `${label}一时走神，请再试一次`),
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          if (process.env.NODE_ENV !== "production") {
            console.error(`${label} sse aborted`, e);
          }
          toast.error("信号断了，请再试一次");
        }
      } finally {
        // flush carry：确保最后一帧的尾巴（若不在 think 块内）能写出
        const tail = flushStreamThinkState(thinkState);
        if (tail) assistantText += tail;
        // 兜底再过一遍同步版（防漏行首"思考过程："这种）
        assistantText = stripThinkChain(assistantText);
        if (rafId !== null) cancelAnimationFrame(rafId);
        setProgressHint(null);
      }

      return { assistantText, cards };
    },
    [],
  );

  const postSubAction = React.useCallback(
    async (url: string, label: string, body: Record<string, unknown>) => {
      if (streamingText !== null || busy) return;
      setBusy(true);
      let res: Response;
      try {
        res = await apiFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error(`${label} fetch failed`, e);
        }
        toast.error("网络一时不通，稍候再试");
        setBusy(false);
        return;
      }
      if (!res.ok) {
        let friendly = `${label}一时走神，请再试一次`;
        try {
          const j = (await res.clone().json()) as { error?: string };
          if (j.error) friendly = j.error;
        } catch {
          /* 静默 */
        }
        if (process.env.NODE_ENV !== "production") {
          console.warn(`${label} ${res.status}`);
        }
        toast.error(friendly);
        setBusy(false);
        return;
      }

      // Branch D: SSE 流式
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/event-stream") && res.body) {
        setStreamingText("");
        const { assistantText, cards } = await consumeStream(res.body, label, {});
        setMessages((m) => commitTurn(m, assistantText, cards));
        setStreamingText(null);
        setBusy(false);
        return;
      }

      // Branch A/B/C: JSON 引导卡
      let data: SubActionJsonResponse;
      try {
        data = (await res.json()) as SubActionJsonResponse;
      } catch {
        toast.error(`${label}一时走神，请再试一次`);
        setBusy(false);
        return;
      }
      if (data.card) {
        const card = data.card;
        setMessages((m) => [
          ...m,
          {
            id: card.id ?? `tmp-card-${Date.now()}`,
            role: "assistant",
            content: card.content,
            created_at: new Date().toISOString(),
            metadata: card.metadata ?? null,
          },
        ]);
      }
      if (!convId && data.conversationId) {
        setConvId(data.conversationId);
        // 仅改 URL，不触发 Next.js Server Component 重渲，避免空 initialMessages 覆盖本地 state
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/chat?cid=${data.conversationId}`);
        }
      }
      setBusy(false);
    },
    [convId, streamingText, busy, consumeStream],
  );

  const send = React.useCallback(
    async (text: string) => {
      if (streamingText !== null || busy) return;

      // dream fast：下一条用户消息直接走 /api/divination/dream
      if (dreamFastWaitingRef.current && convId) {
        dreamFastWaitingRef.current = false;
        await postSubAction("/api/divination/dream", "解梦", {
          conversationId: convId,
          mode: "fast",
          dream: text,
        });
        return;
      }

      // 给 abort 显式传 reason，避免浏览器抛 "signal is aborted without reason"
      // 触发 Next dev overlay 误报（已在下方 catch 中识别 AbortError 静默）。
      abortRef.current?.abort(new DOMException("New request started", "AbortError"));
      abortRef.current = new AbortController();

      const userMsg: DisplayMessage = {
        id: `tmp-user-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);
      setStreamingText("");

      let res: Response;
      try {
        res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, text }),
          signal: abortRef.current.signal,
        });
      } catch (e) {
        // 用户主动取消 / 旧请求被新请求覆盖：静默
        if ((e as Error).name === "AbortError") {
          setStreamingText(null);
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          console.error("/api/chat fetch failed", e);
        }
        toast.error("网络一时不通，稍候再试");
        setStreamingText(null);
        return;
      }

      if (!res.ok || !res.body) {
        let friendly = "轻运一时走神，请再说一次";
        try {
          const j = (await res.clone().json()) as {
            errorCard?: { message?: string };
            error?: string;
          };
          if (j.errorCard?.message) friendly = j.errorCard.message;
          else if (j.error) friendly = j.error;
        } catch {
          /* 静默 */
        }
        if (process.env.NODE_ENV !== "production") {
          console.warn(`/api/chat ${res.status}`);
        }
        toast.error(friendly);
        setStreamingText(null);
        return;
      }

      const { assistantText, cards } = await consumeStream(res.body, "轻运", {
        onMeta: (data) => {
          if (data.conversationId && !convId) {
            setConvId(data.conversationId);
            // 仅改 URL，不触发 Next.js Server Component 重渲，避免空 initialMessages 覆盖本地 state
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", `/chat?cid=${data.conversationId}`);
            }
          }
        },
      });

      setMessages((m) => commitTurn(m, assistantText, cards));
      setStreamingText(null);
    },
    [convId, streamingText, busy, consumeStream, postSubAction],
  );

  return {
    convId,
    messages,
    setMessages,
    streamingText,
    progressHint,
    busy,
    send,
    postSubAction,
    markDreamFastWaiting,
  };
}

function toDisplayCard(card: SseCardData): DisplayMessage {
  return {
    id: card.id!,
    role: "assistant",
    content: card.content,
    created_at: new Date().toISOString(),
    metadata: card.metadata ?? null,
  };
}

function commitTurn(
  prev: DisplayMessage[],
  assistantText: string,
  cards: DisplayMessage[],
): DisplayMessage[] {
  const next = [...prev];
  // 若有卡片（bazi/meihua/explain 等 SSE 路径），则卡片 content 已含完整文字，
  // 不再额外插入纯文本气泡，避免用户看到两条内容相同的消息。
  if (assistantText && cards.length === 0) {
    next.push({
      id: `tmp-asst-${Date.now()}`,
      role: "assistant",
      content: assistantText,
      created_at: new Date().toISOString(),
    });
  }
  for (const cm of cards) next.push(cm);
  return next;
}
