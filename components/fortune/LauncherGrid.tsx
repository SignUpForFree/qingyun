import Link from "next/link";

interface Launcher {
  intent: "divination" | "dream" | "bazi" | "meihua";
  label: string;
  emoji: string;
}

const LAUNCHERS: ReadonlyArray<Launcher> = [
  { intent: "divination", label: "抽签", emoji: "签" },
  { intent: "dream", label: "解梦", emoji: "梦" },
  { intent: "bazi", label: "八字", emoji: "八" },
  { intent: "meihua", label: "测算", emoji: "梅" },
];

/**
 * 4 入口跳转 grid (M4.3, image2)
 *
 * 4×1 横列：抽签 / 解梦 / 八字 / 测算
 * 每个 cell href=/chat?intent=<intent>，直接跳到 chat 页带意图，让 router
 * 自动分发到对应 sub-action。
 */
export function LauncherGrid() {
  return (
    <div className="grid grid-cols-4 gap-2.5" data-testid="launcher-grid">
      {LAUNCHERS.map((l) => (
        <Link
          key={l.intent}
          href={`/chat?intent=${l.intent}`}
          className="group flex flex-col items-center gap-1.5 rounded-2xl border border-[var(--color-accent-lavender)]/25 bg-[var(--color-paper)]/60 px-2 py-3 transition hover:border-[var(--color-accent-plum)]/55 hover:bg-[var(--color-paper)]"
          data-testid={`launcher-${l.intent}`}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-lavender)]/20 to-[var(--color-accent-plum)]/15 font-[family-name:var(--font-serif)] text-[14px] text-[var(--color-ink-plum)]"
            aria-hidden
          >
            {l.emoji}
          </span>
          <span className="text-[11px] tracking-ritual text-[var(--color-ink-mist)] group-hover:text-[var(--color-ink-plum)]">
            {l.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
