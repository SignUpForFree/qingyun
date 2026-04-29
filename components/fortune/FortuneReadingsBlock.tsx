import Link from "next/link";
import type { DailyDim7, DimensionScores7 } from "@/lib/fortune/daily-7dim";
import { DAILY_7_DIMS } from "@/lib/fortune/daily-7dim";
import { parseReadingSections } from "./DimensionDetailCards";
import { FunctionIcon, type FunctionIconName } from "@/components/icons/FunctionIcon";

const DIM_ICON: Record<DailyDim7, FunctionIconName> = {
  爱情: "love",
  财富: "wealth",
  事业: "career",
  学习: "study",
  健康: "health",
  人际: "social",
  心情: "mood",
};

const DIM_TITLE: Record<DailyDim7, string> = {
  爱情: "感情运",
  财富: "财富运",
  事业: "事业运",
  学习: "学业运",
  健康: "健康运",
  人际: "人际运",
  心情: "心情运",
};

interface FortuneReadingsBlockProps {
  date: string;
  scores: DimensionScores7;
  reading: string;
  /** 自定义顺序；默认 DAILY_7_DIMS */
  order?: ReadonlyArray<DailyDim7>;
}

/**
 * "轻运解读" 段：7 维度独立白卡 + 每卡"深入追问 →" 跳 /chat?prefill=
 */
export function FortuneReadingsBlock({
  date,
  scores,
  reading,
  order,
}: FortuneReadingsBlockProps) {
  const dims = order ?? DAILY_7_DIMS;
  const sections = parseReadingSections(reading);
  return (
    <div className="space-y-3" data-testid="fortune-readings-block">
      <h2 className="px-1 font-[family-name:var(--font-serif)] text-[15px] tracking-ritual2 text-[var(--color-ink-plum)]">
        轻 运 解 读
      </h2>
      {dims.map((dim) => {
        const v = scores[dim] ?? 60;
        const body = sections[dim] ?? "今天这个维度的解读暂时没生成。";
        const prefill = `针对今日（${date}）${DIM_TITLE[dim]}（当前分数 ${v}），帮我详细分析一下。`;
        return (
          <div
            key={dim}
            data-testid={`reading-card-${dim}`}
            className="rounded-2xl border border-[var(--color-accent-lavender)]/25 bg-white/60 p-4 backdrop-blur-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[var(--color-ink-plum)]">
                <FunctionIcon
                  name={DIM_ICON[dim]}
                  size={16}
                  className="shrink-0 text-[var(--color-accent-plum)]"
                />
                【{DIM_TITLE[dim]}】
              </span>
              <span className="num-mono text-[12px] text-[var(--color-ink-mist)]">{v} 分</span>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--color-ink-mist)]">
              {body}
            </p>
            <Link
              href={`/chat?prefill=${encodeURIComponent(prefill)}`}
              data-testid={`reading-deep-ask-${dim}`}
              className="mt-3 inline-flex h-8 items-center gap-1 rounded-full bg-gradient-to-r from-[#F0B8C8]/35 to-[#C9A1D9]/35 px-3.5 text-[11px] tracking-ritual text-[var(--color-accent-plum)] transition hover:from-[#F0B8C8]/55 hover:to-[#C9A1D9]/55"
            >
              深 入 追 问 <span>→</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
