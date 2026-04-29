import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/su";
import { FunctionIcon, type FunctionIconName } from "@/components/icons/FunctionIcon";

type IntentKey = "divination" | "meihua" | "dream" | "bazi";

interface LauncherDef {
  intent: IntentKey;
  href: string;
  label: string;
  desc: string;
  icon: FunctionIconName;
}

const COMPACT: ReadonlyArray<LauncherDef> = [
  {
    intent: "divination",
    href: "/chat?intent=divination",
    label: "抽灵签",
    desc: "心有迷茫，一签解惑",
    icon: "divination",
  },
  {
    intent: "meihua",
    href: "/chat?intent=meihua",
    label: "测算",
    desc: "事有两难，一算了然",
    icon: "meihua",
  },
];

const WIDE: ReadonlyArray<LauncherDef> = [
  {
    intent: "dream",
    href: "/chat?intent=dream",
    label: "AI 解梦",
    desc: "梦有深意，一语道破",
    icon: "dream",
  },
  {
    intent: "bazi",
    href: "/chat?intent=bazi",
    label: "AI 八字解读",
    desc: "运有起落，一语知途",
    icon: "bazi",
  },
];

export function LauncherStack() {
  return (
    <div className="space-y-3" data-testid="launcher-stack">
      <div className="grid grid-cols-2 gap-3">
        {COMPACT.map((l) => (
          <CompactLauncherCard key={l.intent} def={l} />
        ))}
      </div>
      {WIDE.map((l) => (
        <WideLauncherCard key={l.intent} def={l} />
      ))}
    </div>
  );
}

function CompactLauncherCard({ def }: { def: LauncherDef }) {
  return (
    <Link
      href={def.href}
      className="group block transition active:scale-[0.985]"
      data-testid={`launcher-${def.intent}`}
    >
      <GlassCard className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-lavender)]/25 to-[var(--color-accent-plum)]/15 text-[var(--color-ink-plum)]">
              <FunctionIcon name={def.icon} size={14} />
            </span>
            <span className="font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-[var(--color-ink-plum)]">
              {def.label}
            </span>
          </span>
          <ChevronRight className="mt-1 h-4 w-4 text-[var(--color-ink-fade)] transition group-hover:text-[var(--color-accent-plum)]" />
        </div>
        <p className="text-[11px] text-[var(--color-ink-fade)]">{def.desc}</p>
      </GlassCard>
    </Link>
  );
}

function WideLauncherCard({ def }: { def: LauncherDef }) {
  return (
    <Link
      href={def.href}
      className="group block transition active:scale-[0.99]"
      data-testid={`launcher-${def.intent}`}
    >
      <GlassCard className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-lavender)]/25 to-[var(--color-accent-plum)]/15 text-[var(--color-ink-plum)]">
          <FunctionIcon name={def.icon} size={18} />
        </span>
        <div className="flex-1">
          <p className="font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-[var(--color-ink-plum)]">
            {def.label}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-fade)]">{def.desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)] transition group-hover:text-[var(--color-accent-plum)]" />
      </GlassCard>
    </Link>
  );
}
