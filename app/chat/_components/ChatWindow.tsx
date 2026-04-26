"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { IntentChips } from "./IntentChips";
import { GlassCard, Sparkle } from "@/components/su";
import type { DisplayMessage } from "./MessageBubble";

interface ChatWindowProps {
  conversationId: string | null;
  initialMessages: DisplayMessage[];
  /** 从 /chat?initial=xxx 跳过来时自动发送的首条消息 */
  autoSendText?: string;
}

interface SubActionResponse {
  conversationId: string;
  userMessage: DisplayMessage;
  // 抽签返回 cardMessage / 八字 dream / meihua 返回 resultMessage / qianwen 还有 aiReadingMessage
  cardMessage?: DisplayMessage;
  resultMessage?: DisplayMessage;
  aiReadingMessage?: DisplayMessage | null;
}

/**
 * 客户端聊天主体（V1.0 文档对齐版）
 *
 * - 4 launcher 已删，永远 ChatInput 在底
 * - /api/chat SSE 事件：meta / token / card / done / error
 *   - card → 把后端写好的引导卡 message 直接 append（含 metadata.ui）
 * - 卡片回调：
 *   - onCardPick(slip_type_picker, key) → 本地插入 slip_question_input 表单
 *   - onCardPick(dream_choice, "fast") → 本地插入"请描述梦境"text + 切到等待用户输入
 *   - onCardPick(dream_choice, "precise") → 本地插入 dream_precise_form
 *   - onCardPick(meihua_method_picker, "number") → 本地插入 meihua_number_input
 *   - onCardSubmit(slip_question_input) → POST /api/divination/qianwen
 *   - onCardSubmit(dream_precise_form) → POST /api/divination/dream mode=precise
 *   - onCardSubmit(bazi_quick_form) → POST /api/divination/bazi (含 profileSnapshot)
 *   - onCardSubmit(meihua_number_input) → POST /api/divination/meihua
 */
export function ChatWindow({
  conversationId: initialConvId,
  initialMessages,
  autoSendText,
}: ChatWindowProps) {
  const router = useRouter();
  const [convId, setConvId] = React.useState<string | null>(initialConvId);
  const [messages, setMessages] = React.useState<DisplayMessage[]>(initialMessages);
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const autoSentRef = React.useRef(false);
  const sendRef = React.useRef<(t: string) => Promise<void>>(() => Promise.resolve());

  /** 临时本地 state：等待用户接 slip_type_picker 选完后把 dimension 暂存；表单提交时用 */
  const slipDimRef = React.useRef<string | null>(null);
  /** dream fast 模式下，下一条用户消息会作为 dreamText 走 dream API */
  const dreamFastWaitingRef = React.useRef(false);
  /** meihua intro 后下一步等用户输入数字+问题 */
  // (本版直接用 meihua_number_input form 解决，无需此 ref)

  const send = React.useCallback(
    async (text: string) => {
      if (streaming !== null || busy) return;

      // dream fast：下一条用户消息直接走 /api/divination/dream
      if (dreamFastWaitingRef.current && convId) {
        dreamFastWaitingRef.current = false;
        await postSubAction("/api/divination/dream", "解梦", {
          conversationId: convId,
          mode: "fast",
          payload: { dreamText: text },
        });
        return;
      }

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
          body: JSON.stringify({ conversationId: convId, text }),
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

      let rafId: number | null = null;
      const flushStreaming = () => {
        rafId = null;
        setStreaming(assistantText);
      };
      const scheduleFlush = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(flushStreaming);
      };
      const cancelPendingFlush = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };

      const cardMessages: DisplayMessage[] = [];

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
                  router.replace(`/chat?cid=${data.conversationId}`);
                }
              }
            } else if (parsed.event === "token") {
              const chunk = typeof parsed.data === "string" ? parsed.data : "";
              assistantText += chunk;
              scheduleFlush();
            } else if (parsed.event === "card") {
              const data = parsed.data as DisplayMessage & { metadata: string | null };
              if (data?.id) {
                cardMessages.push({
                  id: data.id,
                  role: "assistant",
                  content: data.content,
                  created_at: new Date().toISOString(),
                  metadata: data.metadata,
                });
              }
            } else if (parsed.event === "error") {
              toast.error(typeof parsed.data === "string" ? parsed.data : "AI 出错");
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          toast.error("流式中断，请重新发送");
        }
      } finally {
        cancelPendingFlush();
      }

      setMessages((m) => {
        const next = [...m];
        if (assistantText) {
          next.push({
            id: `tmp-asst-${Date.now()}`,
            role: "assistant",
            content: assistantText,
            created_at: new Date().toISOString(),
          });
        }
        for (const cm of cardMessages) next.push(cm);
        return next;
      });
      setStreaming(null);
      void finalConvId;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convId, router, streaming, busy],
  );
  sendRef.current = send;

  const postSubAction = React.useCallback(
    async (
      url: string,
      label: string,
      body: Record<string, unknown>,
    ): Promise<void> => {
      if (streaming !== null || busy) return;
      setBusy(true);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        toast.error(`${label}失败：${e instanceof Error ? e.message : "网络异常"}`);
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        toast.error(`${label}失败 (${res.status})${t ? "：" + t.slice(0, 80) : ""}`);
        setBusy(false);
        return;
      }
      let data: SubActionResponse;
      try {
        data = (await res.json()) as SubActionResponse;
      } catch {
        toast.error(`${label}返回格式异常`);
        setBusy(false);
        return;
      }
      setMessages((m) => {
        const next = [...m, data.userMessage];
        if (data.cardMessage) next.push(data.cardMessage);
        if (data.resultMessage) next.push(data.resultMessage);
        if (data.aiReadingMessage) next.push(data.aiReadingMessage);
        return next;
      });
      if (!convId && data.conversationId) {
        setConvId(data.conversationId);
        router.replace(`/chat?cid=${data.conversationId}`);
      }
      setBusy(false);
    },
    [convId, router, streaming, busy],
  );

  const handleCardPick = React.useCallback(
    (msgId: string, ui: string, key: string) => {
      void msgId;
      if (ui === "slip_type_picker") {
        slipDimRef.current = key;
        setMessages((m) => [
          ...m,
          {
            id: `local-slip-q-${Date.now()}`,
            role: "assistant",
            content: `好的，关于「${key}」，请把你心里默念的事写下来，越具体越准。`,
            created_at: new Date().toISOString(),
            metadata: JSON.stringify({ ui: "slip_question_input" }),
          },
        ]);
      } else if (ui === "dream_choice") {
        if (key === "fast") {
          dreamFastWaitingRef.current = true;
          setMessages((m) => [
            ...m,
            {
              id: `local-dream-fast-${Date.now()}`,
              role: "assistant",
              content: "好的，请把梦境内容讲给我（10-2000 字）。",
              created_at: new Date().toISOString(),
              metadata: JSON.stringify({ ui: "text" }),
            },
          ]);
        } else if (key === "precise") {
          setMessages((m) => [
            ...m,
            {
              id: `local-dream-precise-${Date.now()}`,
              role: "assistant",
              content: "请按下面 4 个维度填写",
              created_at: new Date().toISOString(),
              metadata: JSON.stringify({ ui: "dream_precise_form" }),
            },
          ]);
        }
      } else if (ui === "bazi_focus_picker") {
        if (!convId) {
          toast.error("会话尚未建立，请先与轻运打个招呼");
          return;
        }
        void postSubAction("/api/divination/bazi", "八字", {
          conversationId: convId,
          focus: key,
          userQuestion: `请帮我看看${key}方面`,
        });
      } else if (ui === "meihua_method_picker") {
        // V1 仅留数字测算
        setMessages((m) => [
          ...m,
          {
            id: `local-meihua-num-${Date.now()}`,
            role: "assistant",
            content: "请给我 1-3 个 1-9 的数字",
            created_at: new Date().toISOString(),
            metadata: JSON.stringify({ ui: "meihua_number_input" }),
          },
        ]);
      }
    },
    [convId, postSubAction],
  );

  const handleCardSubmit = React.useCallback(
    async (msgId: string, ui: string, values: Record<string, string>) => {
      void msgId;
      if (!convId) {
        toast.error("会话尚未建立，请先与轻运打个招呼");
        return;
      }
      if (ui === "slip_question_input") {
        const dim = slipDimRef.current;
        if (!dim) return;
        await postSubAction("/api/divination/qianwen", "抽签", {
          conversationId: convId,
          dimension: dim,
          userQuestion: values.userQuestion ?? "",
        });
      } else if (ui === "dream_precise_form") {
        await postSubAction("/api/divination/dream", "解梦", {
          conversationId: convId,
          mode: "precise",
          payload: {
            core: values.core ?? "",
            emotion: values.emotion ?? "",
            reality: values.reality || undefined,
            special: values.special || undefined,
          },
        });
      } else if (ui === "bazi_quick_form") {
        const place = (values.birth_place ?? "").split(/\s+/).filter(Boolean);
        await postSubAction("/api/divination/bazi", "八字", {
          conversationId: convId,
          focus: "综合运势",
          userQuestion: "请帮我看看",
          profileSnapshot: {
            gender: values.gender,
            birth_time: values.birth_time,
            calendar_type: "solar",
            birth_province: place[0] ?? "",
            birth_city: place[1] ?? place[0] ?? "",
            birth_district: place[2] ?? null,
            longitude: 0,
            latitude: 0,
          },
        });
      } else if (ui === "meihua_number_input") {
        const numbers = (values.numbers ?? "")
          .split(/[,，\s]+/)
          .map((s) => Number(s))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 9)
          .slice(0, 3);
        if (numbers.length === 0) {
          toast.error("数字不合法，请填 1-3 个 1-9 的整数");
          return;
        }
        await postSubAction("/api/divination/meihua", "测算", {
          conversationId: convId,
          numbers,
          userQuestion: values.userQuestion ?? "",
        });
      }
    },
    [convId, postSubAction],
  );

  React.useEffect(() => {
    if (autoSendText && !autoSentRef.current) {
      autoSentRef.current = true;
      void sendRef.current(autoSendText);
    }
  }, [autoSendText]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        messages={messages}
        streamingText={streaming}
        onCardPick={handleCardPick}
        onCardSubmit={handleCardSubmit}
        busy={busy}
        empty={
          <div className="flex flex-1 items-center justify-center px-6">
            <GlassCard className="max-w-sm space-y-2 p-5 text-center">
              <p className="text-sm tracking-ritual2 text-[var(--color-ink-plum)]">
                想问就问，我陪你慢慢理 <Sparkle size={10} />
              </p>
              <p className="text-xs text-[var(--color-ink-fade)]">
                抽签 / 解梦 / 八字 / 测算 都直接打字告诉我
              </p>
            </GlassCard>
          </div>
        }
      />
      <IntentChips onPick={(t) => void send(t)} busy={streaming !== null || busy} />
      <ChatInput onSend={send} busy={streaming !== null || busy} />
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
