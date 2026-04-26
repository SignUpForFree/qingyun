import { GlassCard, Sparkle, Divider } from "@/components/su";
import { cn } from "@/lib/utils";
import type { SlipLevel } from "@/db/seed/slips";

interface SlipResultCardProps {
  number: number;
  level: SlipLevel;
  title: string;
  poem: string;
  reading: string;
  dimension: string;
  className?: string;
}

const LEVEL_TONE: Record<
  SlipLevel,
  { dot: string; chip: string; label: string }
> = {
  上上: {
    dot: "from-[#F0B8C8] to-[#C9A1D9]",
    chip: "bg-[var(--color-wuxing-fire)]/35",
    label: "上 上 签",
  },
  上吉: {
    dot: "from-[#F0B8C8] to-[#E8D4E8]",
    chip: "bg-[var(--color-wuxing-fire)]/25",
    label: "上 吉 签",
  },
  吉: {
    dot: "from-[#BFD9C2] to-[#E8C9A4]",
    chip: "bg-[var(--color-wuxing-wood)]/30",
    label: "吉 签",
  },
  平: {
    dot: "from-[#A4B8E8] to-[#E8D4E8]",
    chip: "bg-[var(--color-wuxing-water)]/25",
    label: "平 签",
  },
  渐顺: {
    dot: "from-[#BFD9C2] to-[#A4B8E8]",
    chip: "bg-[var(--color-wuxing-wood)]/25",
    label: "渐 顺 签",
  },
  慎行: {
    dot: "from-[#E8C9A4] to-[#A69AB8]",
    chip: "bg-[var(--color-wuxing-earth)]/30",
    label: "慎 行 签",
  },
};

/**
 * 灵签结果卡（spec §6 抽签 + 设计 §6 SlipResultCard 素笺仙气）
 *
 * - 顶部 等级 chip（淡彩 + 雾紫描边）+ "第 N 签 · 签题"
 * - 中段 签文（仿宋 / serif，居中竖排感）
 * - Divider
 * - 底部 维度 reading（结构化文本）
 *
 * AI 解读不在本卡内，由父级 chat 流式补充在卡片下方
 */
export function SlipResultCard({
  number,
  level,
  title,
  poem,
  reading,
  dimension,
  className,
}: SlipResultCardProps) {
  const tone = LEVEL_TONE[level];

  return (
    <GlassCard className={cn("space-y-4 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            "border border-[var(--color-accent-lavender)]/40",
            tone.chip,
          )}
        >
          {tone.label}
        </span>
        <span className="font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-[var(--color-ink-plum)]">
          第 {number} 签 · {title}
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>

      <div
        className={cn(
          "rounded-[16px] px-4 py-5 text-center",
          "bg-gradient-to-br",
          tone.dot,
          "bg-opacity-30",
        )}
      >
        <p
          className="font-[family-name:var(--font-serif)] text-[15px] leading-loose text-[var(--color-ink-plum)] tracking-ritual"
          style={{ writingMode: "horizontal-tb" }}
        >
          {poem}
        </p>
      </div>

      <Divider />

      <div className="space-y-1.5">
        <p className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          关 于 ·{" "}
          <span className="text-[var(--color-accent-plum)]">{dimension}</span>
        </p>
        <p className="text-sm leading-relaxed text-[var(--color-ink-plum)]">{reading}</p>
      </div>
    </GlassCard>
  );
}
