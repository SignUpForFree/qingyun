"use client";

import { GlassCard } from "@/components/su";
import { MeihuaReadingMarkdown } from "@/components/divination/MeihuaReadingMarkdown";
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
          <MeihuaReadingMarkdown text={text} />
          <span
            aria-hidden
            className="ml-1 inline-block animate-pulse text-[var(--color-accent-lavender)]"
          >
            ✦
          </span>
        </GlassCard>
      </CardWrap>
    </div>
  );
}
