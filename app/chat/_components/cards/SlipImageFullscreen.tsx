"use client";
import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";
import { SlipImageRitualOverlay } from "./SlipImageRitualOverlay";
import { SLIP_LAYOUT_VERSION } from "@/lib/divination/slip-image-url";

export type SlipImageLevel = "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";

export interface SlipImageFullscreenProps {
  slipNumber: number;
  level: SlipImageLevel;
  title: string;
  poemLines: readonly string[];
  imageUrl: string;
  category?: string;
  reading?: string;
  onExplain?: () => void;
  onShare?: () => void;
  busy?: boolean;
  className?: string;
}

const LEVEL_TONE: Record<
  SlipImageLevel,
  { chip: string; chipText: string; glow: string }
> = {
  上上: {
    chip: "from-[#F0B8C8]/50 to-[#C9A1D9]/45",
    chipText: "上 上 签",
    glow: "shadow-[0_12px_40px_rgba(240,184,200,0.35)]",
  },
  上吉: {
    chip: "from-[#F0B8C8]/40 to-[#C9A1D9]/35",
    chipText: "上 吉 签",
    glow: "shadow-[0_12px_40px_rgba(201,161,217,0.3)]",
  },
  吉: {
    chip: "from-[#BFD9C2]/45 to-[#C9A1D9]/35",
    chipText: "吉 签",
    glow: "shadow-[0_12px_40px_rgba(191,217,194,0.28)]",
  },
  平: {
    chip: "from-[#E8D4E8]/55 to-[#C9A1D9]/30",
    chipText: "平 签",
    glow: "shadow-[0_12px_40px_rgba(201,161,217,0.22)]",
  },
  渐顺: {
    chip: "from-[#BFD9C2]/35 to-[#A4B8E8]/30",
    chipText: "渐 顺 签",
    glow: "shadow-[0_12px_40px_rgba(164,184,232,0.25)]",
  },
  慎行: {
    chip: "from-[#E8C9A4]/40 to-[#C9A1D9]/25",
    chipText: "慎 行 签",
    glow: "shadow-[0_12px_40px_rgba(232,201,164,0.22)]",
  },
};

const DEFAULT_TONE = LEVEL_TONE.吉;

/**
 * 抽签结果图卡（新中式雾紫 · 分享向竖版签面）
 */
export function SlipImageFullscreen({
  slipNumber,
  level,
  title,
  poemLines,
  imageUrl,
  category,
  reading,
  onExplain,
  onShare,
  busy,
  className,
}: SlipImageFullscreenProps) {
  const [imgError, setImgError] = React.useState(false);
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const tone = LEVEL_TONE[level] ?? DEFAULT_TONE;

  /** 历史消息 URL 无 layout 时补参，避免一直显示改版前的缓存 PNG */
  const resolvedImageUrl = React.useMemo(() => {
    if (imageUrl.includes("layout=")) return imageUrl;
    const sep = imageUrl.includes("?") ? "&" : "?";
    return `${imageUrl}${sep}layout=${SLIP_LAYOUT_VERSION}`;
  }, [imageUrl]);

  return (
    <GlassCard className={cn("space-y-3 p-3", className)}>
      {!imgError ? (
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className={cn(
            "group relative block w-full overflow-hidden rounded-[20px]",
            "ring-1 ring-[var(--color-accent-lavender)]/35",
            tone.glow,
            "transition duration-300 hover:ring-[var(--color-accent-plum)]/45",
          )}
          aria-label={`查看第 ${slipNumber} 签大图`}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -top-8 -left-8 z-0 h-24 w-24 rounded-full bg-[var(--color-accent-lavender)]/25 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -bottom-6 z-0 h-20 w-20 rounded-full bg-[var(--color-wuxing-fire)]/20 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedImageUrl}
            alt={`第 ${slipNumber} 签 · ${title}`}
            className="relative z-[1] w-full object-contain transition duration-300 group-hover:scale-[1.01]"
            onError={() => setImgError(true)}
            data-testid="slip-card-img"
          />
          <span
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-16",
              "bg-gradient-to-t from-[var(--color-paper-base)]/80 to-transparent",
            )}
          />
          <span
            className={cn(
              "absolute z-[3] rounded-full px-2.5 py-1",
              "left-[8%] bottom-[5%]",
              "bg-white/75 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)] backdrop-blur-sm",
              "shadow-sm ring-1 ring-[var(--color-accent-lavender)]/25",
            )}
          >
            轻触放大
          </span>
        </button>
      ) : (
        <div
          className={cn(
            "space-y-3 rounded-[20px] px-4 py-6 text-center",
            "bg-gradient-to-br from-[#F8F0FC] via-[#FFF9FC] to-[#EDE4F6]",
            "ring-1 ring-[var(--color-accent-lavender)]/30",
          )}
        >
          <p className="text-[12px] text-[var(--color-ink-fade)]">签图加载失败</p>
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

      <SlipImageRitualOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        imageUrl={resolvedImageUrl}
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
              "flex-1 rounded-full px-3 py-2.5 text-[13px] font-[family-name:var(--font-serif)] tracking-ritual",
              "bg-gradient-to-r from-[var(--color-accent-plum)] to-[#9b6b9b] text-white shadow-[var(--shadow-pill)]",
              "hover:opacity-95 active:scale-[0.98]",
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
              "rounded-full border border-[var(--color-accent-lavender)]/50 bg-white/40 px-4 py-2.5",
              "text-[12px] tracking-ritual2 text-[var(--color-ink-plum)] backdrop-blur-sm",
              "hover:border-[var(--color-accent-plum)]/40 hover:bg-[var(--color-accent-lavender)]/15",
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
