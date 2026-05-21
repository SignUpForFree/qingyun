"use client";

import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";
import { CardWrap } from "./TextBubble";

/**
 * 流式解读正文 — 与 MeihuaResultCard / BaziResultCard 同宽（CardWrap 92%）
 */
export function StreamingReadingCard({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div data-testid="streaming-reading-card" className={className}>
      <CardWrap>
        <GlassCard className="w-full p-5">
          <p className="whitespace-pre-wrap text-[13px] leading-[1.85] text-[var(--color-ink-plum)]">
            {text}
            <span
              aria-hidden
              className="ml-1 inline-block animate-pulse text-[var(--color-accent-lavender)]"
            >
              ✦
            </span>
          </p>
        </GlassCard>
      </CardWrap>
    </div>
  );
}
