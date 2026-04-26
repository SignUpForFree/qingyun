import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/su";
import { ChoiceCard } from "./cards/ChoiceCard";
import { FormCard, type FormField } from "./cards/FormCard";
import { SlipImageCard } from "./cards/SlipImageCard";
import { BaziResultCard } from "./cards/BaziResultCard";
import { DreamResultCard } from "./cards/DreamResultCard";
import { SlipResultCard } from "@/components/divination/SlipResultCard";
import { MeihuaResultCard } from "@/components/divination/MeihuaResultCard";
import type { Message } from "@/lib/db/schema";
import type { SlipLevel } from "@/db/seed/slips-v2";
import type { BaziPillars, BaziTenGods } from "@/types/domain";
import type { Wuxing } from "@/lib/bazi/stems-branches";

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

interface MessageBubbleProps {
  message: DisplayMessage;
  streaming?: boolean;
  className?: string;
  onCardPick?: CardPickCallback;
  onCardSubmit?: CardSubmitCallback;
  busy?: boolean;
}

interface MetaUi {
  ui: string;
  [k: string]: unknown;
}

function parseMeta(raw: string | null | undefined): MetaUi | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MetaUi;
  } catch {
    return null;
  }
}

const DREAM_PRECISE_FIELDS: readonly FormField[] = [
  {
    key: "core",
    label: "核心场景",
    type: "textarea",
    required: true,
    max: 500,
    placeholder: "描述梦境画面、人物、地点、发生的事",
  },
  {
    key: "emotion",
    label: "情绪感受",
    type: "textarea",
    required: true,
    max: 200,
    placeholder: "梦中的情绪 + 醒来后的变化",
  },
  {
    key: "reality",
    label: "现实关联（可选）",
    type: "textarea",
    max: 200,
    placeholder: "近期类似的场景或在意的事",
  },
  {
    key: "special",
    label: "特殊细节（可选）",
    type: "textarea",
    max: 200,
    placeholder: "印象深刻的奇怪细节",
  },
];

const BAZI_QUICK_FIELDS: readonly FormField[] = [
  {
    key: "gender",
    label: "性别",
    type: "select",
    required: true,
    options: [
      { value: "male", label: "男" },
      { value: "female", label: "女" },
    ],
  },
  {
    key: "birth_time",
    label: "出生时间（含时辰）",
    type: "text",
    required: true,
    placeholder: "例如 1995-03-22 09:00",
    max: 30,
  },
  {
    key: "birth_place",
    label: "出生地（省 市 区）",
    type: "text",
    required: true,
    placeholder: "例如 上海 上海 黄浦",
    max: 30,
  },
];

const MEIHUA_NUMBER_FIELDS: readonly FormField[] = [
  {
    key: "numbers",
    label: "1-3 个数字（1-9，逗号分隔）",
    type: "text",
    required: true,
    placeholder: "例如 3, 6, 9",
    max: 20,
  },
  {
    key: "userQuestion",
    label: "想测什么事？",
    type: "textarea",
    required: true,
    max: 200,
  },
];

const SLIP_QUESTION_FIELDS: readonly FormField[] = [
  {
    key: "userQuestion",
    label: "心事 / 想问的事",
    type: "textarea",
    required: true,
    max: 200,
    placeholder: "默念在心，写下来更准",
  },
];

interface SlipImageMeta {
  slipNumber: number;
  level: SlipLevel;
  title: string;
  poem: string;
  dimension: string;
  reading: string;
}

interface BaziResultMeta {
  focus: string;
  chart: {
    pillars: BaziPillars;
    fiveElements: Record<Wuxing, number>;
    dayMaster: string;
    tenGods: BaziTenGods;
    currentLuck: string;
  };
}

interface DreamResultMeta {
  mode: "fast" | "precise";
}

/**
 * 单条消息气泡 — 14 ui 分发（spec §6 metadata.ui）
 *
 * 组：
 *   1. text + 用户消息：文本气泡
 *   2. 引导卡（ChoiceCard）：dream_choice / slip_type_picker / meihua_method_picker
 *   3. 表单卡（FormCard）：dream_precise_form / bazi_quick_form / meihua_number_input / slip_question_input
 *   4. 结果卡：slip_image / bazi_result / dream_result / meihua_result / slip_result（兼容旧）
 *   5. 静态提示：meihua_intro / fortune_result（暂占位） / intent_pending
 *
 * onCardPick / onCardSubmit 由 ChatWindow 统一注入；卡片不知道 API，只汇报"用户做了 X 操作"。
 */
export function MessageBubble({
  message,
  streaming,
  className,
  onCardPick,
  onCardSubmit,
  busy,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className={cn("text-center", className)}>
        <span className="rounded-full bg-white/40 px-3 py-1 text-xs text-[var(--color-ink-fade)]">
          {message.content}
        </span>
      </div>
    );
  }

  if (isUser) {
    return <TextBubble message={message} streaming={streaming} isUser className={className} />;
  }

  const meta = parseMeta(message.metadata);
  const ui = meta?.ui ?? "text";

  switch (ui) {
    case "intent_pending":
      return (
        <div className={cn("flex justify-start", className)}>
          <div className="rounded-full bg-white/60 px-3 py-1 text-xs text-[var(--color-ink-fade)]">
            正在识别意图…
          </div>
        </div>
      );

    case "dream_choice":
    case "slip_type_picker":
    case "bazi_focus_picker":
    case "meihua_method_picker": {
      const options =
        ((meta?.options as Array<{ key: string; label: string; hint?: string }>) ?? []);
      return (
        <CardWrap className={className}>
          <ChoiceCard
            title={message.content || "请选择"}
            options={options}
            busy={busy}
            onPick={(k) => onCardPick?.(message.id, ui, k)}
          />
        </CardWrap>
      );
    }

    case "dream_precise_form":
      return (
        <CardWrap className={className}>
          <FormCard
            title="梦境描述"
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
            title={message.content || "请描述你的心事"}
            fields={SLIP_QUESTION_FIELDS}
            submitLabel="开始抽签"
            busy={busy}
            onSubmit={(v) => onCardSubmit?.(message.id, ui, v)}
          />
        </CardWrap>
      );

    case "meihua_intro":
      return <TextBubble message={message} isUser={false} className={className} />;

    case "slip_image": {
      const m = meta as unknown as SlipImageMeta;
      return (
        <CardWrap className={className}>
          <SlipImageCard
            slipNumber={m.slipNumber}
            level={m.level}
            title={m.title}
            poem={m.poem}
            dimension={m.dimension}
            reading={m.reading}
          />
        </CardWrap>
      );
    }

    case "slip_result": {
      const m = meta as unknown as SlipImageMeta;
      return (
        <CardWrap className={className}>
          <SlipResultCard
            number={m.slipNumber}
            level={m.level}
            title={m.title}
            poem={m.poem}
            reading={m.reading}
            dimension={m.dimension}
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

    case "dream_result": {
      const m = meta as unknown as DreamResultMeta;
      return (
        <CardWrap className={className}>
          <DreamResultCard mode={m.mode} aiText={message.content} />
        </CardWrap>
      );
    }

    case "meihua_result": {
      const m = meta as unknown as {
        ben: { number: number; name: string; upper: string; lower: string };
        hu: { number: number; name: string; upper: string; lower: string };
        bian: { number: number; name: string; upper: string; lower: string };
        guaZhongGua: { number: number; name: string; upper: string; lower: string };
        dongYao: number;
        tiYong: { ti: string; yong: string; relation: string };
        yingQi: { speed: "fast" | "medium" | "slow"; timeHint: string; branchHour: string | null };
        verdict: string;
      };
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

function CardWrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div className="w-full max-w-[92%]">{children}</div>
    </div>
  );
}

function TextBubble({
  message,
  streaming,
  isUser,
  className,
}: {
  message: DisplayMessage;
  streaming?: boolean;
  isUser: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}>
      <div className="flex max-w-[82%] gap-2">
        {!isUser && (
          <div
            aria-hidden
            className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E8E4FF] to-[#FFE8F0]"
          >
            <Sparkle size={10} variant="diamond" />
          </div>
        )}
        <div
          className={cn(
            "relative whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-relaxed",
            "font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
            isUser
              ? "rounded-[18px] rounded-br-[4px] bg-gradient-to-br from-[#F0B8C8]/40 to-[#C9A1D9]/40 shadow-pill"
              : "glass hairline rounded-[18px] rounded-bl-[4px]",
          )}
        >
          {message.content}
          {streaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[var(--color-accent-lavender)] align-middle"
            />
          )}
        </div>
      </div>
    </div>
  );
}
