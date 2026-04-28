"use client";
import * as React from "react";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { cn } from "@/lib/utils";
import type { SlipLevel } from "@/db/seed/slips-v2";

interface SlipImageCardProps {
  slipNumber: number;
  level: SlipLevel;
  title: string;
  poem: string;
  reading: string;
  dimension: string;
  className?: string;
}

const LEVEL_TONE: Record<SlipLevel, { chip: string; label: string }> = {
  上上: { chip: "bg-[var(--color-wuxing-fire)]/35", label: "上 上 签" },
  上吉: { chip: "bg-[var(--color-wuxing-fire)]/25", label: "上 吉 签" },
  中吉: { chip: "bg-[var(--color-wuxing-wood)]/30", label: "中 吉 签" },
  吉: { chip: "bg-[var(--color-wuxing-wood)]/30", label: "吉 签" },
  平: { chip: "bg-[var(--color-wuxing-water)]/25", label: "平 签" },
  中平: { chip: "bg-[var(--color-wuxing-water)]/25", label: "中 平 签" },
  渐顺: { chip: "bg-[var(--color-wuxing-wood)]/25", label: "渐 顺 签" },
  慎行: { chip: "bg-[var(--color-wuxing-earth)]/30", label: "慎 行 签" },
  下下: { chip: "bg-[var(--color-wuxing-metal)]/25", label: "下 下 签" },
};

/**
 * 灵签结果卡（V1.0 文档 §6 抽签）
 *
 * 与 SlipResultCard 不同：底部不再嵌 reading 文字，
 * 改为 base64 / dynamic image 占位（Canvas 服务端合成由 M4.1 提供）。
 *
 * 在 Canvas 接口就位之前，先用本卡片纯样式 + 文本，保证 ChatWindow 能 dispatch 渲染。
 */
export function SlipImageCard({
  slipNumber,
  level,
  title,
  poem,
  reading,
  dimension,
  className,
}: SlipImageCardProps) {
  const tone = LEVEL_TONE[level];
  const imageUrl = `/api/divination/slip-image/${slipNumber}`;
  const [imgError, setImgError] = React.useState(false);

  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
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
          第 {slipNumber} 签 · {title}
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>

      {!imgError ? (
        // 服务端 Canvas 合成图（M4.1）；失败回退到文本签诗
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`第 ${slipNumber} 签 · ${title}`}
          className="w-full rounded-[12px] border border-[var(--color-accent-lavender)]/30"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={cn(
            "rounded-[12px] px-4 py-5 text-center",
            "bg-gradient-to-br from-[#F0B8C8]/40 to-[#C9A1D9]/40",
          )}
        >
          <p className="font-[family-name:var(--font-serif)] text-[15px] leading-loose text-[var(--color-ink-plum)] tracking-ritual">
            {poem}
          </p>
        </div>
      )}

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
