"use client";

import { ChevronRight } from "lucide-react";
import { GlassCard, Sparkle } from "@/components/su";
import { FunctionIcon, type FunctionIconName } from "@/components/icons/FunctionIcon";
import { cn } from "@/lib/utils";

type IntentKey = "divination" | "meihua" | "dream" | "bazi";

interface LauncherDef {
  intent: IntentKey;
  text: string;
  label: string;
  desc: string;
  icon: FunctionIconName;
}

const COMPACT: ReadonlyArray<LauncherDef> = [
  {
    intent: "divination",
    text: "我要抽灵签",
    label: "抽灵签",
    desc: "心有迷茫，一签解惑",
    icon: "divination",
  },
  {
    intent: "meihua",
    text: "我要测算",
    label: "测算",
    desc: "事有两难，一算了然",
    icon: "meihua",
  },
];

const WIDE: ReadonlyArray<LauncherDef> = [
  {
    intent: "dream",
    text: "我要解梦",
    label: "AI 解梦",
    desc: "梦有深意，一语道破",
    icon: "dream",
  },
  {
    intent: "bazi",
    text: "我要八字解读",
    label: "AI 八字解读",
    desc: "运有起落，一语知途",
    icon: "bazi",
  },
];

interface EmptyLauncherProps {
  onPick: (text: string) => void;
  busy?: boolean;
}

export function EmptyLauncher({ onPick, busy }: EmptyLauncherProps) {
  return (
    <div
      className="mx-auto w-full max-w-md space-y-4 px-4 pt-14"
      data-testid="chat-empty-launcher"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ai-avatar.png"
            alt=""
            className="h-[72px] w-[72px] shrink-0 drop-shadow-[0_4px_12px_rgba(201,161,217,0.35)]"
          />
          <h1
            className={cn(
              "font-sans text-[32px] font-semibold leading-none tracking-normal text-[var(--color-ink-plum)]",
            )}
          >
            福小运
          </h1>
        </div>
        <p className="max-w-[320px] text-center font-[family-name:var(--font-serif)] text-[15px] font-medium leading-relaxed tracking-ritual text-[var(--color-ink-plum)]">
          嗨！我可以基于国学知识理论，为您提供日常决策、运势、财富、情感、命理分析、解梦等服务，请问有什么可以帮您？
          <Sparkle size={10} className="ml-1 inline-block align-middle" />
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COMPACT.map((l) => (
          <CompactCard key={l.intent} def={l} onPick={onPick} busy={busy} />
        ))}
      </div>
      {WIDE.map((l) => (
        <WideCard key={l.intent} def={l} onPick={onPick} busy={busy} />
      ))}
    </div>
  );
}

interface CardProps {
  def: LauncherDef;
  onPick: (text: string) => void;
  busy?: boolean;
}

function CompactCard({ def, onPick, busy }: CardProps) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => !busy && onPick(def.text)}
      className={cn(
        "group block w-full text-left transition active:scale-[0.985]",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
      data-testid={`chat-launcher-${def.intent}`}
    >
      <GlassCard className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-lavender)]/25 to-[var(--color-accent-plum)]/15 text-[var(--color-ink-plum)]">
              <FunctionIcon name={def.icon} size={14} />
            </span>
            <span className="font-[family-name:var(--font-serif)] text-[15px] font-bold tracking-ritual text-[var(--color-ink-plum)]">
              {def.label}
            </span>
          </span>
          <ChevronRight className="mt-1 h-4 w-4 text-[var(--color-ink-fade)] transition group-hover:text-[var(--color-accent-plum)]" />
        </div>
        <p className="text-[11px] text-[var(--color-ink-fade)]">{def.desc}</p>
      </GlassCard>
    </button>
  );
}

function WideCard({ def, onPick, busy }: CardProps) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => !busy && onPick(def.text)}
      className={cn(
        "group block w-full text-left transition active:scale-[0.99]",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
      data-testid={`chat-launcher-${def.intent}`}
    >
      <GlassCard className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-lavender)]/25 to-[var(--color-accent-plum)]/15 text-[var(--color-ink-plum)]">
          <FunctionIcon name={def.icon} size={18} />
        </span>
        <div className="flex-1">
          <p className="font-[family-name:var(--font-serif)] text-[15px] font-bold tracking-ritual text-[var(--color-ink-plum)]">
            {def.label}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-fade)]">{def.desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)] transition group-hover:text-[var(--color-accent-plum)]" />
      </GlassCard>
    </button>
  );
}
