"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/util/api-fetch";
import { saveImageToAlbum } from "@/lib/util/save-image";
import type { DisplayMessage } from "./MessageBubble";
import type { CardActionCallback, CardPickCallback, CardSubmitCallback } from "./MessageBubble";

interface UseCardHandlersOptions {
  convId: string | null;
  messages: DisplayMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  postSubAction: (url: string, label: string, body: Record<string, unknown>) => Promise<void>;
  /** dream fast 模式：标记下一条 send() 走 dream 路由 */
  markDreamFastWaiting: () => void;
}

export interface UseCardHandlersReturn {
  handleCardPick: CardPickCallback;
  handleCardSubmit: CardSubmitCallback;
  handleCardAction: CardActionCallback;
}

/**
 * 引导卡 + 结果卡的交互回调
 *
 * - onCardPick：用户在 picker 卡上点选项（slip_type / dream_choice / bazi_focus / meihua_method / profile）
 * - onCardSubmit：用户提交输入卡（slip_question / dream_precise / bazi_quick / meihua_number）
 * - onCardAction：结果卡上的二级动作（slip_image 的"立即解读"/"保存到相册"）
 */
export function useCardHandlers({
  convId,
  messages,
  setMessages,
  postSubAction,
  markDreamFastWaiting,
}: UseCardHandlersOptions): UseCardHandlersReturn {
  // 抽签 dimension 在 picker→input 跨两条卡之间暂存
  const slipDimRef = React.useRef<string | null>(null);

  const handleCardPick = React.useCallback<CardPickCallback>(
    (msgId, ui, key) => {
      if (ui === "slip_type_picker") {
        slipDimRef.current = key;
        setMessages((m) => [
          ...m,
          makeLocalCard(
            `local-slip-q-${Date.now()}`,
            "请描述你遇到的事情和想问的问题，描述越具体，解读越精准哦。",
            {
              ui: "slip_question_input",
            },
          ),
        ]);
        return;
      }
      if (ui === "dream_choice") {
        if (key === "fast") {
          markDreamFastWaiting();
          setMessages((m) => [
            ...m,
            makeLocalCard(`local-dream-fast-${Date.now()}`, "请描述你的梦境，描述越详细解读越精准哦。", { ui: "text" }),
          ]);
        } else if (key === "precise") {
          setMessages((m) => [
            ...m,
            makeLocalCard(`local-dream-precise-${Date.now()}`, "请填写以下信息，帮助我更精准地解读你的梦境。", {
              ui: "dream_precise_form",
            }),
          ]);
        }
        return;
      }
      if (ui === "bazi_focus_picker") {
        if (!convId) {
          toast.error("会话尚未建立，请先与轻运打个招呼");
          return;
        }
        const focusMsg = messages.find((m) => m.id === msgId);
        const profileId = readProfileId(focusMsg);
        if (!profileId) {
          toast.error("档案信息丢失，请重新点八字按钮");
          return;
        }
        void postSubAction("/api/divination/bazi", "八字", {
          conversationId: convId,
          profileId,
          focus: key,
          userQuestion: `请帮我看看${key}方面`,
        });
        return;
      }
      if (ui === "meihua_method_picker") {
        // V1 仅留数字测算
        setMessages((m) => [
          ...m,
          makeLocalCard(
            `local-meihua-num-${Date.now()}`,
            "请给我 1-3 个 1-9 的数字",
            { ui: "meihua_number_input" },
          ),
        ]);
        return;
      }
      if (ui === "profile_picker") {
        if (!convId) {
          toast.error("会话尚未建立，请先与轻运打个招呼");
          return;
        }
        const msg = messages.find((m) => m.id === msgId);
        const intent = readIntent(msg);
        const profileId = key;
        void (async () => {
          try {
            await apiFetch("/api/chat/set-profile", {
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
    [convId, messages, postSubAction, setMessages, markDreamFastWaiting],
  );

  const handleCardSubmit = React.useCallback<CardSubmitCallback>(
    async (msgId, ui, values) => {
      if (!convId) {
        toast.error("会话尚未建立，请先与轻运打个招呼");
        return;
      }
      if (ui === "slip_question_input") {
        const dim = slipDimRef.current;
        if (!dim) return;
        // 先插入摇签动画卡，再调 API
        setMessages((m) => [
          ...m,
          makeLocalCard(`local-slip-draw-${Date.now()}`, "", {
            ui: "slip_drawing",
            durationMs: 3500,
          }),
        ]);
        await postSubAction("/api/divination/qianwen", "抽签", {
          conversationId: convId,
          category: dim,
          userQuestion: values.userQuestion ?? "",
        });
        return;
      }
      if (ui === "dream_precise_form") {
        await postSubAction("/api/divination/dream", "解梦", {
          conversationId: convId,
          mode: "precise",
          core: values.core ?? "",
          emotion: values.emotion ?? "",
          reality: values.reality || undefined,
          special: values.special || undefined,
        });
        return;
      }
      if (ui === "bazi_quick_form") {
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
        return;
      }
      if (ui === "meihua_number_input") {
        const numbers = (values.numbers ?? "")
          .split(/[,，\s]+/)
          .map((s) => Number(s))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 9)
          .slice(0, 3);
        if (numbers.length === 0) {
          toast.error("数字不合法，请填 1-3 个 1-9 的整数");
          return;
        }
        const numMsg = messages.find((m) => m.id === msgId);
        const profileId = readProfileId(numMsg);
        await postSubAction("/api/divination/meihua", "测算", {
          conversationId: convId,
          ...(profileId ? { profileId } : {}),
          numbers,
          userQuestion: values.userQuestion ?? "",
        });
      }
    },
    [convId, messages, postSubAction],
  );

  const handleCardAction = React.useCallback<CardActionCallback>(
    async (msgId, ui, action) => {
      if (ui === "slip_image" && action === "explain") {
        if (!convId) {
          toast.error("会话尚未建立，请先与轻运打个招呼");
          return;
        }
        await postSubAction("/api/divination/qianwen/explain", "解读", {
          messageId: msgId,
        });
        return;
      }
      if (ui === "slip_report" && action === "full_explain") {
        if (!convId) {
          toast.error("会话尚未建立，请先与轻运打个招呼");
          return;
        }
        // 找到对应的 slip_image 消息 ID
        const msg = messages.find((m) => m.id === msgId);
        let sourceMessageId = msgId;
        if (msg?.metadata) {
          try {
            const meta = JSON.parse(msg.metadata) as { sourceMessageId?: string };
            if (meta.sourceMessageId) sourceMessageId = meta.sourceMessageId;
          } catch { /* fallback to msgId */ }
        }
        await postSubAction("/api/divination/qianwen/explain", "完整解读", {
          messageId: sourceMessageId,
          fullInterpret: true,
        });
        return;
      }
      if (ui === "slip_image" && action === "share") {
        const msg = messages.find((m) => m.id === msgId);
        if (!msg?.metadata) {
          toast.error("图片信息丢失");
          return;
        }
        try {
          const meta = JSON.parse(msg.metadata) as {
            imageUrl?: string;
            slipNumber?: number;
          };
          if (!meta.imageUrl) {
            toast.error("签图未生成");
            return;
          }
          await saveImageToAlbum(
            meta.imageUrl,
            `轻运签-${meta.slipNumber ?? "slip"}.png`,
          );
          toast.success("已保存到相册");
        } catch (e) {
          const msg = e instanceof Error && e.message.includes("相册权限")
            ? e.message
            : "保存失败，请稍候再试";
          toast.error(msg);
        }
        return;
      }
    },
    [convId, messages, postSubAction],
  );

  return { handleCardPick, handleCardSubmit, handleCardAction };
}

function makeLocalCard(
  id: string,
  content: string,
  meta: Record<string, unknown>,
): DisplayMessage {
  return {
    id,
    role: "assistant",
    content,
    created_at: new Date().toISOString(),
    metadata: JSON.stringify(meta),
  };
}

function readProfileId(msg: DisplayMessage | undefined): string | undefined {
  if (!msg?.metadata) return undefined;
  try {
    const meta = JSON.parse(msg.metadata) as { profileId?: string };
    return meta.profileId;
  } catch {
    return undefined;
  }
}

function readIntent(msg: DisplayMessage | undefined): "bazi" | "meihua" {
  if (!msg?.metadata) return "bazi";
  try {
    const meta = JSON.parse(msg.metadata) as { intent?: string };
    return meta.intent === "meihua" ? "meihua" : "bazi";
  } catch {
    return "bazi";
  }
}
