"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { GlassCard, Sparkle } from "@/components/su";
import type { Intent } from "@/types/domain";

interface QuickItem {
  intent: Intent;
  label: string;
  hint: string;
  /** 五行配色，呼应素笺仙气配色 */
  toneClass: string;
}

const ITEMS: readonly QuickItem[] = [
  {
    intent: "divination",
    label: "抽支灵签",
    hint: "随心一抽，看支签上写了什么",
    toneClass: "bg-[var(--color-wuxing-fire)]/30",
  },
  {
    intent: "dream",
    label: "解个梦",
    hint: "把昨夜的梦讲给我听",
    toneClass: "bg-[var(--color-wuxing-water)]/30",
  },
  {
    intent: "bazi",
    label: "看八字",
    hint: "我的命盘讲了什么",
    toneClass: "bg-[var(--color-wuxing-earth)]/30",
  },
  {
    intent: "meihua",
    label: "起一卦",
    hint: "为眼下这件事起卦",
    toneClass: "bg-[var(--color-wuxing-wood)]/30",
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  const router = useRouter();
  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-center text-xs uppercase tracking-ritual3 text-[var(--color-ink-fade)]">
        随手挑一个
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((it) => (
          <button
            key={it.intent}
            type="button"
            onClick={() => router.push(`/chat/new?intent=${it.intent}`)}
            className="text-left transition-transform active:scale-[0.98]"
          >
            <GlassCard className={cn("space-y-1 p-4", it.toneClass)}>
              <div className="flex items-center gap-1.5 text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]">
                {it.label}
                <Sparkle size={9} variant="diamond" />
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--color-ink-fade)]">{it.hint}</p>
            </GlassCard>
          </button>
        ))}
      </div>
    </div>
  );
}
