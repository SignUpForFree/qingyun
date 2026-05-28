"use client";

import type { ReactNode } from "react";
import { Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

export interface DivinationReadingSectionProps {
  aiText: string;
  /** 解读仍在生成（含模型 reasoning 尚未出字阶段） */
  readingStreaming?: boolean;
  /** 结果卡内解读区顶部分隔线；独立流式气泡不需要 */
  withDivider?: boolean;
  /** 无正文且流式中的占位文案 */
  thinkingLabel?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * 八字 / 梅花结果卡内的解读区：无正文且流式中显示「思考中...」，有正文后逐字展示 + ✦
 */
export function DivinationReadingSection({
  aiText,
  readingStreaming = false,
  withDivider = true,
  thinkingLabel = "思考中...",
  className,
  children,
}: DivinationReadingSectionProps) {
  const text = aiText ?? "";
  const hasText = text.trim().length > 0;
  const thinking = readingStreaming && !hasText;

  if (!hasText && !readingStreaming) return null;

  return (
    <div
      className={cn(
        "space-y-2",
        withDivider && "border-t border-[var(--color-accent-lavender)]/20 pt-3",
        className,
      )}
      data-testid={thinking ? "divination-reading-thinking" : "divination-reading-body"}
    >
      {thinking ? (
        <p className="flex items-center gap-1.5 text-[13px] leading-[1.85] text-[var(--color-ink-mist)]">
          <Sparkle size={10} variant="diamond" className="shrink-0" />
          <span className="animate-pulse tracking-ritual2">{thinkingLabel}</span>
        </p>
      ) : (
        <>
          <Sparkle size={10} variant="diamond" className="inline-block" />
          {children}
          {readingStreaming ? (
            <span
              aria-hidden
              className="ml-1 inline-block animate-pulse text-[var(--color-accent-lavender)]"
            >
              ✦
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
