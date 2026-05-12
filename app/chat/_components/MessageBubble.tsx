import { cn } from "@/lib/utils";
import { ChoiceCard } from "./cards/ChoiceCard";
import { FormCard } from "./cards/FormCard";
import { SlipImageCard } from "./cards/SlipImageCard";
import { SlipImageFullscreen } from "./cards/SlipImageFullscreen";
import { SlipReportCard } from "./cards/SlipReportCard";
import { BaziResultCard } from "./cards/BaziResultCard";
import { DreamResultCard } from "./cards/DreamResultCard";
import { ProfilePickerCard } from "./cards/ProfilePickerCard";
import { ProgressLongTaskCard } from "./cards/ProgressLongTaskCard";
import { ErrorCard } from "./cards/ErrorCard";
import { ShakeSlipAnim } from "./cards/ShakeSlipAnim";
import { SlipResultCard } from "@/components/divination/SlipResultCard";
import { MeihuaResultCard } from "@/components/divination/MeihuaResultCard";
import { CardWrap, TextBubble } from "./cards/TextBubble";
import {
  parseMeta,
  type BaziResultMeta,
  type DreamResultMeta,
  type ErrorCardMeta,
  type MeihuaResultMeta,
  type ProfilePickerMeta,
  type ProgressLongTaskMeta,
  type SlipImageMeta,
  type SlipReportMeta,
} from "./cards/meta-types";
import {
  BAZI_QUICK_FIELDS,
  DREAM_PRECISE_FIELDS,
  MEIHUA_NUMBER_FIELDS,
  SLIP_QUESTION_FIELDS,
} from "./cards/form-fields";
import type { Message } from "@/lib/db/schema";
import type { SlipImageLevel } from "./cards/SlipImageFullscreen";

export type DisplayMessage = Pick<
  Message,
  "id" | "role" | "content" | "created_at"
> & {
  metadata?: string | null;
};

export type CardPickCallback = (msgId: string, ui: string, key: string) => void;
export type CardSubmitCallback = (
  msgId: string,
  ui: string,
  values: Record<string, string>,
) => void;
export type CardActionCallback = (msgId: string, ui: string, action: string) => void;

interface MessageBubbleProps {
  message: DisplayMessage;
  streaming?: boolean;
  className?: string;
  onCardPick?: CardPickCallback;
  onCardSubmit?: CardSubmitCallback;
  onCardAction?: CardActionCallback;
  busy?: boolean;
  /** user 气泡左侧头像（来自默认档案 avatar_url） */
  userAvatarUrl?: string | null;
  /** user 昵称（avatar fallback + alt） */
  userNickname?: string;
}

/**
 * 单条消息气泡 — 22 ui 分发（M2.14, spec §4.4）
 *
 * 分组（22）：
 *  state/transient: intent_pending / progress_long_task / error_card / slip_drawing
 *  pickers:         choice_card / profile_picker / slip_type_picker / bazi_focus_picker
 *                   (V1.0 别名: dream_choice / meihua_method_picker)
 *  forms:           slip_question_input / bazi_quick_form / meihua_number_input /
 *                   dream_precise_form
 *  results:         slip_image / slip_report / dream_result_fast / dream_result_precise /
 *                   bazi_result / meihua_result / fortune_brief_card
 *                   (V1.0 别名: dream_result / slip_result)
 *  auxiliary:       summary_card / profile_added_hint / quick_action_chips
 *  fallback:        text（包括 meihua_intro 静态提示）
 *
 * onCardPick / onCardSubmit / onCardAction 由 ChatWindow 统一注入；
 * 卡片不知道 API，只汇报"用户做了 X 操作"。
 */
export function MessageBubble({
  message,
  streaming,
  className,
  onCardPick,
  onCardSubmit,
  onCardAction,
  busy,
  userAvatarUrl,
  userNickname,
}: MessageBubbleProps) {
  if (message.role === "system") {
    return (
      <div className={cn("text-center", className)}>
        <span className="rounded-full bg-white/40 px-3 py-1 text-xs text-[var(--color-ink-fade)]">
          {message.content}
        </span>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <TextBubble
        message={message}
        streaming={streaming}
        isUser
        className={className}
        userAvatarUrl={userAvatarUrl}
        userNickname={userNickname}
      />
    );
  }

  const meta = parseMeta(message.metadata);
  const ui = meta?.ui ?? "text";

  switch (ui) {
    // ============ state / transient ============

    case "intent_pending":
      return (
        <div className={cn("flex justify-start", className)}>
          <div className="rounded-full bg-white/60 px-3 py-1 text-xs text-[var(--color-ink-fade)]">
            正在识别意图…
          </div>
        </div>
      );

    case "progress_long_task": {
      const m = (meta ?? {}) as unknown as ProgressLongTaskMeta;
      return (
        <CardWrap className={className}>
          <ProgressLongTaskCard
            etaSec={m.etaSec}
            stage={m.stage}
            percent={m.percent}
            cancellable={m.cancellable}
            onCancel={
              m.cancellable
                ? () => onCardAction?.(message.id, ui, "cancel")
                : undefined
            }
          />
        </CardWrap>
      );
    }

    case "error_card": {
      const m = (meta ?? {}) as unknown as ErrorCardMeta;
      return (
        <CardWrap className={className}>
          <ErrorCard
            message={m.message ?? "出错了，请稍后重试"}
            code={m.code}
            retryable={m.retryable}
            onRetry={
              m.retryable
                ? () => onCardAction?.(message.id, ui, "retry")
                : undefined
            }
          />
        </CardWrap>
      );
    }

    case "slip_drawing": {
      const m = (meta ?? {}) as { durationMs?: number };
      return (
        <CardWrap className={className}>
          <ShakeSlipAnim
            durationMs={m.durationMs}
            onComplete={() => onCardAction?.(message.id, ui, "complete")}
          />
        </CardWrap>
      );
    }

    // ============ pickers ============

    case "choice_card":
    case "dream_choice":
    case "slip_type_picker":
    case "bazi_focus_picker":
    case "meihua_method_picker": {
      const options =
        ((meta?.options as Array<{ key: string; label: string; hint?: string }>) ?? []);
      const title =
        ((meta?.question as string | undefined) ?? message.content) || "请选择";
      return (
        <CardWrap className={className}>
          <ChoiceCard
            title={title}
            options={options}
            busy={busy}
            onPick={(k) => onCardPick?.(message.id, ui, k)}
          />
        </CardWrap>
      );
    }

    case "profile_picker": {
      const m = (meta ?? {}) as unknown as ProfilePickerMeta;
      return (
        <CardWrap className={className}>
          <ProfilePickerCard
            profiles={m.profiles ?? []}
            conversationId={m.conversationId}
            allowAddNew={m.allowAddNew}
            busy={busy}
            onPick={(id) => onCardPick?.(message.id, ui, id)}
          />
        </CardWrap>
      );
    }

    // ============ forms ============

    case "dream_precise_form":
      return (
        <CardWrap className={className}>
          <FormCard
            title={message.content || "补充梦境信息"}
            fields={DREAM_PRECISE_FIELDS}
            submitLabel="精准解梦"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    case "bazi_quick_form":
      return (
        <CardWrap className={className}>
          <FormCard
            title="请填写八字信息"
            fields={BAZI_QUICK_FIELDS}
            submitLabel="生成解读"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    case "meihua_number_input":
      return (
        <CardWrap className={className}>
          <FormCard
            title="请给我 1-3 个 1-9 的数字"
            fields={MEIHUA_NUMBER_FIELDS}
            submitLabel="起卦测算"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    case "slip_question_input":
      return (
        <CardWrap className={className}>
          <FormCard
            title={message.content || "请描述你遇到的事情和想问的问题，描述越具体，解读越精准哦。"}
            fields={SLIP_QUESTION_FIELDS}
            submitLabel="开始抽签"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    // ============ results ============

    case "slip_image": {
      const m = meta as unknown as SlipImageMeta;
      // V2.0：spec 字段 poemLines + imageUrl + category
      // V1.0：旧字段 poem + reading + dimension（fall back 到 V1.0 卡片）
      if (m.poemLines && m.imageUrl) {
        return (
          <CardWrap className={className}>
            <SlipImageFullscreen
              slipNumber={m.slipNumber}
              level={m.level as SlipImageLevel}
              title={m.title}
              poemLines={m.poemLines}
              imageUrl={m.imageUrl}
              category={m.category}
              onExplain={() => onCardAction?.(message.id, ui, "explain")}
              onShare={() => onCardAction?.(message.id, ui, "share")}
              busy={busy}
            />
          </CardWrap>
        );
      }
      return (
        <CardWrap className={className}>
          <SlipImageCard
            slipNumber={m.slipNumber}
            level={m.level}
            title={m.title}
            poem={m.poem ?? ""}
            dimension={m.dimension ?? ""}
            reading={m.reading ?? ""}
          />
        </CardWrap>
      );
    }

    case "slip_report": {
      const m = meta as unknown as SlipReportMeta;
      return (
        <CardWrap className={className}>
          <SlipReportCard
            slipNumber={m.slipNumber}
            level={m.level}
            title={m.title}
            poem={m.poem}
            dimension={m.dimension}
            reading={m.reading}
            aiInterpretation={m.aiInterpretation || message.content}
            sections={m.sections}
            isFullInterpret={m.isFullInterpret}
            onShare={() => onCardAction?.(message.id, ui, "share")}
            onFullExplain={
              !m.isFullInterpret
                ? () => onCardAction?.(message.id, ui, "full_explain")
                : undefined
            }
          />
        </CardWrap>
      );
    }

    case "slip_result": {
      // V1.0 别名 → SlipResultCard
      const m = meta as unknown as SlipImageMeta;
      return (
        <CardWrap className={className}>
          <SlipResultCard
            number={m.slipNumber}
            level={m.level}
            title={m.title}
            poem={m.poem ?? (m.poemLines ?? []).join("\n")}
            reading={m.reading ?? ""}
            dimension={m.dimension ?? m.category ?? ""}
            readings={m.readings}
          />
        </CardWrap>
      );
    }

    case "bazi_result": {
      const m = meta as unknown as BaziResultMeta;
      return (
        <CardWrap className={className}>
          <BaziResultCard chart={m.chart} focus={m.focus} aiText={message.content} />
        </CardWrap>
      );
    }

    case "dream_result_fast":
      return (
        <CardWrap className={className}>
          <DreamResultCard mode="fast" aiText={message.content} />
        </CardWrap>
      );

    case "dream_result_precise": {
      const m = meta as unknown as DreamResultMeta;
      return (
        <CardWrap className={className}>
          <DreamResultCard
            mode="precise"
            aiText={message.content}
            sections={
              m.empathy
                ? {
                    empathy: m.empathy,
                    threeViews: m.threeViews ?? { zhouGong: "", freud: "", jung: "" },
                    coreMeaning: m.coreMeaning ?? "",
                    suggestions: m.suggestions ?? [],
                    subconsciousMsg: m.subconsciousMsg ?? "",
                    conclusion: m.conclusion ?? "",
                  }
                : null
            }
          />
        </CardWrap>
      );
    }

    case "dream_result": {
      // V1.0 别名 — 用 metadata.mode 区分
      const m = meta as unknown as DreamResultMeta;
      return (
        <CardWrap className={className}>
          <DreamResultCard mode={m.mode ?? "fast"} aiText={message.content} />
        </CardWrap>
      );
    }

    case "meihua_result": {
      const m = meta as unknown as MeihuaResultMeta;
      return (
        <CardWrap className={className}>
          <MeihuaResultCard
            ben={m.ben}
            hu={m.hu}
            bian={m.bian}
            guaZhongGua={m.guaZhongGua}
            dongYao={m.dongYao}
            ti={m.tiYong.ti}
            yong={m.tiYong.yong}
            relation={m.tiYong.relation}
            verdict={m.verdict}
            speed={m.yingQi.speed}
            timeHint={m.yingQi.timeHint}
            branchHour={m.yingQi.branchHour}
          />
        </CardWrap>
      );
    }

    case "fortune_brief_card": {
      const m = (meta ?? {}) as { date?: string; overall?: number; topDimension?: string; oneLiner?: string };
      return (
        <CardWrap className={className}>
          <div className="glass hairline rounded-[16px] p-4">
            <p className="text-[11px] tracking-ritual2 text-[var(--color-ink-fade)]">
              {m.date ?? "今日"} · {m.topDimension ?? "综合"}
            </p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-2xl text-[var(--color-ink-plum)]">
              {m.overall ?? "—"}
              <span className="ml-1 text-xs text-[var(--color-ink-fade)]">分</span>
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink-plum)]">{m.oneLiner ?? message.content}</p>
          </div>
        </CardWrap>
      );
    }

    // ============ auxiliary ============

    case "summary_card":
      return (
        <div className={cn("flex justify-center", className)}>
          <span className="rounded-full bg-[var(--color-accent-lavender)]/15 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-fade)]">
            ✦ {message.content || "已记录本段对话要点"}
          </span>
        </div>
      );

    case "profile_added_hint": {
      const m = (meta ?? {}) as { nickname?: string };
      return (
        <div className={cn("flex justify-center", className)}>
          <span className="rounded-full bg-[var(--color-wuxing-wood)]/20 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]">
            ✓ 已新增档案 · {m.nickname ?? "新档案"}
          </span>
        </div>
      );
    }

    case "quick_action_chips": {
      const m = (meta ?? {}) as {
        chips?: Array<{ key: string; label: string; intent?: string }>;
      };
      const chips = m.chips ?? [];
      return (
        <div className={cn("flex flex-wrap gap-2", className)}>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onCardPick?.(message.id, ui, c.key)}
              disabled={busy}
              className={cn(
                "rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/30 px-3 py-1 text-[12px] tracking-ritual2 text-[var(--color-ink-plum)]",
                "hover:bg-[var(--color-accent-lavender)]/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      );
    }

    case "meihua_intro":
    case "text":
    default:
      return (
        <TextBubble
          message={message}
          streaming={streaming}
          isUser={false}
          className={className}
        />
      );
  }
}
