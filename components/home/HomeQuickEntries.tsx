import Link from "next/link";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

interface Entry {
  label: string;
  text: string;
  hint: string;
  toneClass: string;
  large?: boolean;
}

const ENTRIES: Entry[] = [
  {
    label: "抽灵签",
    text: "我要抽灵签",
    hint: "心有迷茫\n一签解惑",
    toneClass: "bg-[var(--color-wuxing-fire)]/30",
  },
  {
    label: "测算",
    text: "我要测算",
    hint: "事有两难\n一算了然",
    toneClass: "bg-[var(--color-wuxing-water)]/30",
  },
  {
    label: "AI 解梦",
    text: "我要 AI 解梦",
    hint: "梦有深意 一语点破",
    toneClass: "bg-[var(--color-wuxing-wood)]/30",
    large: true,
  },
  {
    label: "AI 八字解读",
    text: "我要八字解读",
    hint: "运有起落 一语知途",
    toneClass: "bg-[var(--color-wuxing-earth)]/30",
    large: true,
  },
];

/**
 * 首页 4 入口（V1.0 文档 §1 mockup）
 *
 * - 上一行：抽灵签 / 测算（小卡 2 列）
 * - 下两行：AI 解梦 / AI 八字解读（大卡，全宽各占一行）
 *
 * 点击 → /chat?initial=<text>，触发 ChatWindow autoSend → /api/chat 关键词层命中
 */
export function HomeQuickEntries() {
  const small = ENTRIES.filter((e) => !e.large);
  const big = ENTRIES.filter((e) => e.large);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {small.map((e) => (
          <EntryCard key={e.label} entry={e} />
        ))}
      </div>
      {big.map((e) => (
        <EntryCard key={e.label} entry={e} />
      ))}
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const href = `/chat?initial=${encodeURIComponent(entry.text)}`;
  return (
    <Link
      href={href}
      className="block transition-transform active:scale-[0.98]"
    >
      <GlassCard className={cn("p-4", entry.toneClass)}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-[family-name:var(--font-serif)] text-base tracking-ritual text-[var(--color-ink-plum)]">
              {entry.label}
              <Sparkle size={9} variant="diamond" />
            </div>
            <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-[var(--color-ink-fade)]">
              {entry.hint}
            </p>
          </div>
          <span aria-hidden className="text-[var(--color-ink-fade)]">
            →
          </span>
        </div>
      </GlassCard>
    </Link>
  );
}
