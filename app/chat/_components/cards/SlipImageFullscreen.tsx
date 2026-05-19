"use client";
import * as React from "react";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";
import { SlipImageRitualOverlay } from "./SlipImageRitualOverlay";

export type SlipImageLevel = "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";

export interface SlipImageFullscreenProps {
  slipNumber: number;
  level: SlipImageLevel;
  title: string;
  poemLines: readonly string[];
  imageUrl: string;
  category?: string;
  onExplain?: () => void;
  onShare?: () => void;
  busy?: boolean;
  className?: string;
}

const LEVEL_TONE: Record<SlipImageLevel, { chip: string; label: string }> = {
  上上: { chip: "bg-[var(--color-wuxing-fire)]/35", label: "上 上 签" },
  上吉: { chip: "bg-[var(--color-wuxing-fire)]/25", label: "上 吉 签" },
  吉: { chip: "bg-[var(--color-wuxing-wood)]/25", label: "吉 签" },
  平: { chip: "bg-[var(--color-wuxing-water)]/25", label: "平 签" },
  渐顺: { chip: "bg-[var(--color-wuxing-wood)]/20", label: "渐 顺 签" },
  慎行: { chip: "bg-[var(--color-wuxing-earth)]/30", label: "慎 行 签" },
};

const DEFAULT_TONE = { chip: "bg-[var(--color-wuxing-water)]/25", label: "签" };

/**
 * 抽签结果图卡（M2.11，spec §4.4 slip_image，image10）
 *
 * - 全宽展示后端 Canvas 合成的签号图（M3.16 提供 /api/divination/slip-image/[n]）
 * - 失败时回退展示纯文本签诗 4 句
 * - "立即解读" 按钮 → onExplain → POST /api/divination/qianwen/explain
 * - "保存到相册" 按钮（微信 JS-SDK previewImage 在 M5 接入，本卡只触发回调）
 * - M4.24 加木纹背景 + 红印章 + 落款书法字仪式特化
 */
export function SlipImageFullscreen({
  slipNumber,
  level,
  title,
  poemLines,
  imageUrl,
  category,
  onExplain,
  onShare,
  busy,
  className,
}: SlipImageFullscreenProps) {
  const [imgError, setImgError] = React.useState(false);
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const tone = LEVEL_TONE[level] ?? DEFAULT_TONE;

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`第 ${slipNumber} 签 · ${title}`}
          className="w-full cursor-zoom-in rounded-[12px] border border-[var(--color-accent-lavender)]/30 transition hover:opacity-90"
          onError={() => setImgError(true)}
          onClick={() => setOverlayOpen(true)}
          data-testid="slip-card-img"
        />
      ) : (
        <div
          className={cn(
            "rounded-[12px] px-4 py-5 text-center space-y-3",
            "bg-gradient-to-br from-[#F0B8C8]/40 to-[#C9A1D9]/40",
          )}
        >
          <p className="text-[12px] text-[var(--color-ink-fade)]">签文加载失败，请重试</p>
          {poemLines.map((line, i) => (
            <p
              key={i}
              className="font-[family-name:var(--font-serif)] text-[15px] leading-loose tracking-ritual text-[var(--color-ink-plum)]"
            >
              {line}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setImgError(false)}
            className="text-[11px] text-[var(--color-accent-plum)] underline"
          >
            重新加载
          </button>
        </div>
      )}

      {category && (
        <p className="text-[11px] tracking-ritual2 text-[var(--color-ink-fade)]">
          关 于 ·{" "}
          <span className="text-[var(--color-accent-plum)]">{category}</span>
        </p>
      )}

      <SlipImageRitualOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        imageUrl={imageUrl}
        slipNumber={slipNumber}
        level={level}
        title={title}
        poemLines={poemLines}
        category={category}
      />

      <div className="flex gap-2">
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            disabled={busy}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-[13px] font-[family-name:var(--font-serif)] tracking-ritual",
              "bg-[var(--color-accent-plum)] text-white hover:opacity-90",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            立即解读
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            disabled={busy}
            className={cn(
              "rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/30 px-3 py-2 text-[12px] tracking-ritual2 text-[var(--color-ink-plum)] hover:bg-[var(--color-accent-lavender)]/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            保存到相册
          </button>
        )}
      </div>
    </GlassCard>
  );
}
