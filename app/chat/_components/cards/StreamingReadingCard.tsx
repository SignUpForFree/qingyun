"use client";

import { DivinationReadingSection } from "@/components/divination/DivinationReadingSection";
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
          <DivinationReadingSection aiText={text} readingStreaming withDivider={false}>
            {text.trim() ? <MeihuaReadingMarkdown text={text} /> : null}
          </DivinationReadingSection>
        </GlassCard>
      </CardWrap>
    </div>
  );
}
