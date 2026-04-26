import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/su";
import { SlipResultCard } from "@/components/divination/SlipResultCard";
import { MeihuaResultCard } from "@/components/divination/MeihuaResultCard";
import type { Message } from "@/lib/db/schema";
import type { SlipLevel } from "@/db/seed/slips";

export type DisplayMessage = Pick<
  Message,
  "id" | "role" | "content" | "created_at"
> & {
  metadata?: string | null;
};

interface MessageBubbleProps {
  message: DisplayMessage;
  streaming?: boolean;
  className?: string;
}

interface SlipResultMeta {
  ui: "slip_result";
  slipNumber: number;
  level: SlipLevel;
  title: string;
  poem: string;
  dimension: string;
  reading: string;
}

function parseSlipMeta(meta: string | null | undefined): SlipResultMeta | null {
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta) as { ui?: string };
    if (parsed.ui !== "slip_result") return null;
    const m = parsed as SlipResultMeta;
    if (
      typeof m.slipNumber !== "number" ||
      typeof m.title !== "string" ||
      typeof m.poem !== "string" ||
      typeof m.dimension !== "string" ||
      typeof m.reading !== "string"
    ) {
      return null;
    }
    return m;
  } catch {
    return null;
  }
}

interface MeihuaHexagramView {
  number: number;
  name: string;
  upper: string;
  lower: string;
}

interface MeihuaResultMeta {
  ui: "meihua_result";
  ben: MeihuaHexagramView;
  hu: MeihuaHexagramView;
  bian: MeihuaHexagramView;
  guaZhongGua: MeihuaHexagramView;
  dongYao: number;
  tiYong: { ti: string; yong: string; relation: string };
  yingQi: { speed: "fast" | "medium" | "slow"; timeHint: string; branchHour: string | null };
  verdict: string;
}

function parseMeihuaMeta(meta: string | null | undefined): MeihuaResultMeta | null {
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta) as { ui?: string };
    if (parsed.ui !== "meihua_result") return null;
    const m = parsed as MeihuaResultMeta;
    if (
      !m.ben?.name ||
      !m.hu?.name ||
      !m.bian?.name ||
      !m.guaZhongGua?.name ||
      typeof m.dongYao !== "number" ||
      !m.tiYong?.relation ||
      !m.yingQi?.timeHint
    ) {
      return null;
    }
    return m;
  } catch {
    return null;
  }
}

/**
 * 单条消息气泡（spec §4 Chat Session）
 *
 * - User: 右对齐 + 淡紫粉渐变 over glass + rounded-br-sm 切角
 * - Assistant: 左对齐 + glass + rounded-bl-sm 切角 + 头部 ✦ 身份标
 * - Streaming: 在尾部加细 lavender 竖线（不用 ▍ 粗块）
 * - 结构化卡片：metadata.ui === 'slip_result' → 内嵌 SlipResultCard
 */
export function MessageBubble({ message, streaming, className }: MessageBubbleProps) {
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

  const slipMeta = !isUser ? parseSlipMeta(message.metadata) : null;
  if (slipMeta) {
    return (
      <div className={cn("flex w-full justify-start", className)}>
        <div className="w-full max-w-[92%]">
          <SlipResultCard
            number={slipMeta.slipNumber}
            level={slipMeta.level}
            title={slipMeta.title}
            poem={slipMeta.poem}
            reading={slipMeta.reading}
            dimension={slipMeta.dimension}
          />
        </div>
      </div>
    );
  }

  const meihuaMeta = !isUser ? parseMeihuaMeta(message.metadata) : null;
  if (meihuaMeta) {
    return (
      <div className={cn("flex w-full justify-start", className)}>
        <div className="w-full max-w-[92%]">
          <MeihuaResultCard
            ben={meihuaMeta.ben}
            hu={meihuaMeta.hu}
            bian={meihuaMeta.bian}
            guaZhongGua={meihuaMeta.guaZhongGua}
            dongYao={meihuaMeta.dongYao}
            ti={meihuaMeta.tiYong.ti}
            yong={meihuaMeta.tiYong.yong}
            relation={meihuaMeta.tiYong.relation}
            verdict={meihuaMeta.verdict}
            speed={meihuaMeta.yingQi.speed}
            timeHint={meihuaMeta.yingQi.timeHint}
            branchHour={meihuaMeta.yingQi.branchHour}
          />
        </div>
      </div>
    );
  }

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
