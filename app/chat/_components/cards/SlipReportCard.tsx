"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { SlipImageLevel } from "./SlipImageFullscreen";

export interface SlipSection {
  emoji: string;
  label: string;
  shortReading: string;
  longReading: string;
}

export interface SlipReportCardProps {
  slipNumber: number;
  level: SlipImageLevel;
  title: string;
  poem: string;
  dimension: string;
  reading: string;
  aiInterpretation: string;
  sections?: SlipSection[] | null;
  isFullInterpret?: boolean;
  onShare?: () => void;
  onFullExplain?: () => void;
  streaming?: boolean;
  className?: string;
}

const LEVEL_TONE: Record<
  SlipImageLevel,
  { chip: string; label: string }
> = {
  上上: {
    chip: "from-[#F0B8C8]/45 to-[#C9A1D9]/40",
    label: "上 上 签",
  },
  上吉: {
    chip: "from-[#F0B8C8]/40 to-[#C9A1D9]/35",
    label: "上 吉 签",
  },
  吉: {
    chip: "from-[#BFD9C2]/40 to-[#C9A1D9]/35",
    label: "吉 签",
  },
  平: {
    chip: "from-[#E8D4E8]/50 to-[#C9A1D9]/30",
    label: "平 签",
  },
  渐顺: {
    chip: "from-[#BFD9C2]/35 to-[#A4B8E8]/28",
    label: "渐 顺 签",
  },
  慎行: {
    chip: "from-[#E8C9A4]/38 to-[#C9A1D9]/28",
    label: "慎 行 签",
  },
};

const DEFAULT_TONE = { chip: "from-[#E8D4E8]/45 to-[#C9A1D9]/35", label: "签" };

/**
 * 抽签解读报告卡 — 雾紫新中式，与签图 / 对话主色一致
 */
export function SlipReportCard({
  slipNumber,
  level,
  title,
  poem,
  dimension,
  reading,
  aiInterpretation,
  sections,
  isFullInterpret,
  onShare,
  onFullExplain,
  streaming,
  className,
}: SlipReportCardProps) {
  const hasStructuredSections = sections && sections.length > 0;
  const tone = LEVEL_TONE[level] ?? DEFAULT_TONE;

  return (
    <div
      data-testid="slip-report-card"
      className={cn(
        "relative overflow-hidden rounded-[20px] p-5",
        "border border-[var(--color-accent-lavender)]/45",
        "bg-gradient-to-b from-[#FFFBFE] via-[#F8F0FC] to-[#EDE4F6]",
        "shadow-[0_12px_40px_rgba(201,161,217,0.22)]",
        "space-y-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-[var(--color-accent-lavender)]/20 blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-[var(--color-wuxing-fire)]/15 blur-2xl"
      />

      <header className="relative z-[1] space-y-2.5 text-center">
        <span
          className={cn(
            "inline-block rounded-full border border-[var(--color-accent-lavender)]/50 px-3.5 py-1",
            "bg-gradient-to-r text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            tone.chip,
          )}
        >
          {tone.label}
        </span>
        <h3
          className="font-[family-name:var(--font-calligraphy),var(--font-serif)] text-[22px] tracking-ritual text-[var(--color-ink-plum)]"
          data-testid="report-title"
        >
          第 {slipNumber} 签 · {title}
        </h3>
        <p className="text-[12px] tracking-ritual2 text-[var(--color-ink-fade)]">
          求签类型：
          <span className="text-[var(--color-accent-plum)]">{dimension}</span>
        </p>
      </header>

      <div
        className={cn(
          "relative z-[1] rounded-[14px] px-4 py-4",
          "border border-[var(--color-accent-lavender)]/35 bg-white/55 backdrop-blur-sm",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        )}
      >
        <p className="whitespace-pre-line text-center font-[family-name:var(--font-serif)] text-[16px] leading-loose tracking-ritual text-[var(--color-ink-plum)]">
          {poem}
        </p>
      </div>

      <div
        aria-hidden
        className="relative z-[1] flex items-center justify-center gap-3 py-0.5"
      >
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--color-accent-lavender)]/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-lavender)]/70" />
        <span className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--color-accent-lavender)]/50" />
      </div>

      <section className="relative z-[1] space-y-2">
        <div className="flex justify-center">
          <span
            className={cn(
              "rounded-full border border-[var(--color-accent-lavender)]/50 px-4 py-1",
              "bg-[var(--color-accent-lavender)]/12 text-[12px] font-medium tracking-ritual2 text-[var(--color-accent-plum)]",
            )}
          >
            解签语
          </span>
        </div>
        <p className="whitespace-pre-line text-center text-[15px] leading-relaxed text-[var(--color-ink-mist)]">
          {reading}
        </p>
      </section>

      {hasStructuredSections ? (
        <div data-testid="slip-sections" className="relative z-[1] space-y-4">
          {sections.map((sec, i) => (
            <section key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{sec.emoji}</span>
                <span
                  className={cn(
                    "rounded-full border border-[var(--color-accent-lavender)]/40 px-2.5 py-0.5",
                    "text-[12px] font-medium tracking-ritual2 text-[var(--color-accent-plum)]",
                    "bg-white/40",
                  )}
                >
                  {sec.label}
                </span>
              </div>
              {sec.shortReading && (
                <p className="text-[15px] font-medium leading-relaxed text-[var(--color-ink-plum)]">
                  {sec.shortReading}
                </p>
              )}
              {sec.longReading && (
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-[var(--color-ink-mist)]">
                  {sec.longReading}
                </p>
              )}
              {streaming && i === sections.length - 1 && (
                <span
                  className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--color-accent-plum)] align-middle"
                  aria-hidden
                />
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="relative z-[1] space-y-2">
          <div className="flex justify-center">
            <span
              className={cn(
                "rounded-full border border-[var(--color-accent-lavender)]/50 px-4 py-1",
                "bg-[var(--color-accent-lavender)]/12 text-[12px] font-medium tracking-ritual2 text-[var(--color-accent-plum)]",
              )}
            >
              AI 解读
            </span>
          </div>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--color-ink-plum)]">
            {aiInterpretation}
            {streaming && (
              <span
                className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--color-accent-plum)] align-middle"
                aria-hidden
              />
            )}
          </p>
        </section>
      )}

      {!isFullInterpret && onFullExplain && (
        <div className="relative z-[1] flex justify-center pt-1">
          <button
            type="button"
            onClick={onFullExplain}
            data-testid="btn-full-explain"
            className={cn(
              "rounded-full px-5 py-2.5 text-[13px] font-[family-name:var(--font-serif)] tracking-ritual",
              "bg-gradient-to-r from-[var(--color-accent-plum)] to-[#9b6b9b] text-white shadow-[var(--shadow-pill)]",
              "hover:opacity-95 active:scale-[0.98]",
            )}
          >
            我要完整解读
          </button>
        </div>
      )}

      <div
        aria-hidden
        data-testid="report-seal"
        className={cn(
          "absolute z-[2] flex h-11 w-9 flex-col items-center justify-center rounded-lg",
          "border border-[var(--color-accent-plum)]/35 bg-[var(--color-accent-lavender)]/15",
          "text-[var(--color-accent-plum)]/80 shadow-sm",
          onShare ? "bottom-14 right-4" : "bottom-4 right-4",
        )}
        style={{ fontFamily: "var(--font-serif)", lineHeight: 1 }}
      >
        <span className="text-[9px] leading-none">福</span>
        <span className="text-[9px] leading-none">小</span>
        <span className="text-[9px] leading-none">运</span>
      </div>

      {onShare && (
        <div className="relative z-[1] flex justify-end pr-12 pt-1">
          <button
            type="button"
            onClick={onShare}
            className={cn(
              "rounded-full border border-[var(--color-accent-lavender)]/50 bg-white/50 px-4 py-2",
              "text-[12px] tracking-ritual2 text-[var(--color-ink-plum)] backdrop-blur-sm",
              "hover:border-[var(--color-accent-plum)]/40 hover:bg-[var(--color-accent-lavender)]/20",
            )}
          >
            分享报告
          </button>
        </div>
      )}
    </div>
  );
}
