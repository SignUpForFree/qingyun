"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { HistoryDrawer } from "./HistoryDrawer";
import { DreamPreciseModal, type DreamPreciseFormData } from "./DreamPreciseModal";
import { GlassCard, Sparkle } from "@/components/su";
import type { DisplayMessage } from "./MessageBubble";

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
}

const INTENT_AUTO_TEXT: Record<NonNullable<ChatWindowProps["initialIntent"]>, string> = {
  divination: "我要抽灵签",
  dream: "我要 AI 解梦",
  bazi: "我要八字解读",
  meihua: "我要测算",
};

/**
 * sub-action route Branch A/B/C 的 JSON 形态
 *   { step: string, card: {id,role,content,metadata}, profileId? }
 * Branch D 走 SSE，由 Content-Type: text/event-stream 判定后另走流式分支。
 */
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
  initialIntent,
  openHistoryOnMount,
  prefillText,
}: ChatWindowProps) {
  const router = useRouter();
  const [convId, setConvId] = React.useState<string | null>(initialConvId);
  const [messages, setMessages] = React.useState<DisplayMessage[]>(initialMessages);
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [progressHint, setProgressHint] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [drawerOpen, setDrawerOpenRaw] = React.useState<boolean>(Boolean(openHistoryOnMount));
  // 抽屉关闭时把焦点恢复到打开它的元素（AppHeader 那个真触发器或 ?openHistory= 入口）
  const prevFocusRef = React.useRef<HTMLElement | null>(null);
  const setDrawerOpen = React.useCallback((next: boolean) => {
    if (next) {
      prevFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    } else if (prevFocusRef.current) {
      // requestAnimationFrame 让 Radix close transition 跑完再 focus，避免被覆盖
      const target = prevFocusRef.current;
      requestAnimationFrame(() => target.focus());
      prevFocusRef.current = null;
    }
    setDrawerOpenRaw(next);
  }, []);
  /** M4.9: dream precise modal 仪式特化 fullscreen */
  const [dreamModalOpen, setDreamModalOpen] = React.useState(false);
  const dreamModalSeenRef = React.useRef<Set<string>>(new Set());
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
        if (process.env.NODE_ENV !== "production") console.error("/api/chat fetch failed", e);
        toast.error("网络一时不通，稍候再试");
        setStreaming(null);
        return;
      }

      if (!res.ok || !res.body) {
        // 优先读 errorCard / error 字段，剩下统一温柔兜底
        let friendly = "轻运一时走神，请再说一次";
        try {
          const j = (await res.clone().json()) as {
            errorCard?: { message?: string };
            error?: string;
          };
          if (j.errorCard?.message) friendly = j.errorCard.message;
          else if (j.error) friendly = j.error;
        } catch {
          /* 静默 — 不把 raw text 暴露给用户 */
        }
        if (process.env.NODE_ENV !== "production") {
          console.warn(`/api/chat ${res.status}`);
        }
        toast.error(friendly);
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
            } else if (parsed.event === "progress") {
              const data = parsed.data as { stage?: string; percent?: number } | string;
              if (typeof data === "object" && data !== null) {
                const stage = String(data.stage ?? "");
                const pct = typeof data.percent === "number" ? data.percent : 0;
                setProgressHint(stage ? `${stageLabel(stage)} ${pct}%` : null);
              }
            } else if (parsed.event === "done") {
              setProgressHint(null);
            } else if (parsed.event === "error") {
              const data = parsed.data as
                | { message?: string; code?: string }
                | string;
              const msg =
                typeof data === "string"
                  ? data
                  : (data?.message ?? "轻运一时走神，请再说一次");
              toast.error(msg);
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          if (process.env.NODE_ENV !== "production") console.error("chat sse aborted", e);
          toast.error("信号断了，请再发一次");
        }
      } finally {
        cancelPendingFlush();
        setProgressHint(null);
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
        if (process.env.NODE_ENV !== "production") console.error(`${label} fetch failed`, e);
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
          /* 静默 — 不把 raw text 给用户看 */
        }
        if (process.env.NODE_ENV !== "production") {
          console.warn(`${label} ${res.status}`);
        }
        toast.error(friendly);
        setBusy(false);
        return;
      }

      // Branch D: SSE 流式（meta / progress / token / card / done / error）
      // — 八字/梅花/解梦的最终生成都走这里，token 逐字显示在 streaming 气泡
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/event-stream") && res.body) {
        setStreaming("");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
        const cardMessages: DisplayMessage[] = [];
        let rafId: number | null = null;
        const flush = () => {
          rafId = null;
          setStreaming(assistantText);
        };
        const sched = () => {
          if (rafId !== null) return;
          rafId = requestAnimationFrame(flush);
        };
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
              if (parsed.event === "token") {
                const chunk = typeof parsed.data === "string" ? parsed.data : "";
                assistantText += chunk;
                sched();
              } else if (parsed.event === "card") {
                const data = parsed.data as DisplayMessage & {
                  metadata: string | null;
                };
                if (data?.id) {
                  cardMessages.push({
                    id: data.id,
                    role: "assistant",
                    content: data.content,
                    created_at: new Date().toISOString(),
                    metadata: data.metadata,
                  });
                }
              } else if (parsed.event === "progress") {
                const data = parsed.data as
                  | { stage?: string; percent?: number }
                  | string;
                if (typeof data === "object" && data !== null) {
                  const stage = String(data.stage ?? "");
                  const pct = typeof data.percent === "number" ? data.percent : 0;
                  setProgressHint(stage ? `${stageLabel(stage)} ${pct}%` : null);
                }
              } else if (parsed.event === "done") {
                setProgressHint(null);
              } else if (parsed.event === "error") {
                const data = parsed.data as
                  | { message?: string }
                  | string;
                const msg =
                  typeof data === "string"
                    ? data
                    : (data?.message ?? `${label}一时走神，请再试一次`);
                toast.error(msg);
              }
            }
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            if (process.env.NODE_ENV !== "production") console.error(`${label} sse aborted`, e);
            toast.error("信号断了，请再试一次");
          }
        } finally {
          if (rafId !== null) cancelAnimationFrame(rafId);
          setProgressHint(null);
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
        setBusy(false);
        return;
      }

      // Branch A/B/C: JSON 引导卡（quick_form / focus_picker / profile_picker / number_input ...）
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
        // 从卡片 metadata 拿 profileId — bazi route Branch D 必填
        // (没传会落 404 "档案不存在或无权限")
        const focusMsg = messages.find((m) => m.id === msgId);
        let bazProfileId: string | undefined;
        if (focusMsg?.metadata) {
          try {
            const meta = JSON.parse(focusMsg.metadata) as { profileId?: string };
            bazProfileId = meta.profileId;
          } catch {
            /* 忽略，下面会 toast */
          }
        }
        if (!bazProfileId) {
          toast.error("档案信息丢失，请重新点八字按钮");
          return;
        }
        void postSubAction("/api/divination/bazi", "八字", {
          conversationId: convId,
          profileId: bazProfileId,
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
      } else if (ui === "profile_picker") {
        if (!convId) {
          toast.error("会话尚未建立，请先与轻运打个招呼");
          return;
        }
        // 从 message.metadata 读 intent 决定下一步走 bazi 还是 meihua
        const msg = messages.find((m) => m.id === msgId);
        let intent: "bazi" | "meihua" = "bazi";
        if (msg?.metadata) {
          try {
            const meta = JSON.parse(msg.metadata) as { intent?: string };
            if (meta.intent === "meihua") intent = "meihua";
          } catch {
            /* 忽略，按默认 bazi 兜底 */
          }
        }
        const profileId = key;
        void (async () => {
          try {
            await fetch("/api/chat/set-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId: convId, profileId }),
            });
          } catch {
            // set-profile 仅做记忆，失败不阻塞下一步
          }
          if (intent === "meihua") {
            await postSubAction("/api/divination/meihua", "梅花", {
              conversationId: convId,
              profileId,
            });
          } else {
            await postSubAction("/api/divination/bazi", "八字", {
              conversationId: convId,
              profileId,
            });
          }
        })();
      }
    },
    [convId, postSubAction, messages],
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
        // bazi route schema 字段是 quickFormData{gender,birth_time,birth_place}，
        // 不是 profileSnapshot；focus 不在这里传，等用户在 focus_picker 选
        // (硬编码 "综合运势" 不在 VALID_CATEGORIES 6 维度里 → zod enum 直接 400)
        if (!values.gender || !values.birth_time || !values.birth_place) {
          toast.error("请填完八字三项再提交");
          return;
        }
        await postSubAction("/api/divination/bazi", "八字", {
          conversationId: convId,
          quickFormData: {
            gender: values.gender,
            birth_time: values.birth_time,
            birth_place: values.birth_place,
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
    if (autoSentRef.current) return;
    if (autoSendText) {
      autoSentRef.current = true;
      void sendRef.current(autoSendText);
      return;
    }
    if (initialIntent && INTENT_AUTO_TEXT[initialIntent]) {
      autoSentRef.current = true;
      void sendRef.current(INTENT_AUTO_TEXT[initialIntent]);
    }
  }, [autoSendText, initialIntent]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // M4.9: 当列表新增 dream_precise_form 卡 → 自动开 modal（每张卡只开一次）
  React.useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role !== "assistant" || !m.metadata) continue;
      try {
        const meta = JSON.parse(m.metadata) as { ui?: string };
        if (meta.ui === "dream_precise_form" && !dreamModalSeenRef.current.has(m.id)) {
          dreamModalSeenRef.current.add(m.id);
          setDreamModalOpen(true);
        }
      } catch {
        /* skip 坏 JSON */
      }
      break; // 只看最新一条
    }
  }, [messages]);

  const handleDreamModalSubmit = React.useCallback(
    async (data: DreamPreciseFormData) => {
      if (!convId) {
        toast.error("会话尚未建立，请先与轻运打个招呼");
        return;
      }
      setDreamModalOpen(false);
      await postSubAction("/api/divination/dream", "解梦", {
        conversationId: convId,
        mode: "precise",
        payload: {
          core: data.core,
          emotion: data.emotion,
          reality: data.reality || undefined,
          special: data.special || undefined,
        },
      });
    },
    [convId, postSubAction],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 隐藏内嵌 trigger，左 ☰ 已被 AppHeader right 的 HistoryDrawer 接管。
          这里只保留受控 open state（M2.X 自动打开 drawer 流程依赖）。 */}
      <HistoryDrawer
        currentId={convId ?? undefined}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        hideTrigger
      />
      <DreamPreciseModal
        open={dreamModalOpen}
        onClose={() => setDreamModalOpen(false)}
        onSubmit={handleDreamModalSubmit}
        busy={busy}
      />
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
      <ChatInput
        onSend={send}
        busy={streaming !== null || busy}
        initialText={prefillText}
        showQuickChips
        solid
        progressHint={progressHint}
      />
    </div>
  );
}

function stageLabel(stage: string): string {
  if (stage === "computing") return "演算中";
  if (stage === "streaming") return "拟稿中";
  if (stage === "classifying") return "判定中";
  return stage;
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
