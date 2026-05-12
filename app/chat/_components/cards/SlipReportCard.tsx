"use client";
import * as React from "react";
import { Divider } from "@/components/su";
import { cn } from "@/lib/utils";
import { MembershipGate } from "@/components/auth/MembershipGate";
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
  /** 结构化解读段落（可选，有则分段渲染，无则 fallback aiInterpretation 纯文本） */
  sections?: SlipSection[] | null;
  /** 是否是完整解读（7 块），false = 部分解读（1 块 + 轻运寄语） */
  isFullInterpret?: boolean;
  onShare?: () => void;
  onFullExplain?: () => void;
  className?: string;
}

const LEVEL_CHIP: Record<SlipImageLevel, string> = {
  上上: "bg-[var(--color-wuxing-fire)]/35",
  上吉: "bg-[var(--color-wuxing-fire)]/25",
  吉: "bg-[var(--color-wuxing-wood)]/25",
  平: "bg-[var(--color-wuxing-water)]/25",
  渐顺: "bg-[var(--color-wuxing-wood)]/20",
  慎行: "bg-[var(--color-wuxing-earth)]/30",
};

const LEVEL_LABEL: Record<SlipImageLevel, string> = {
  上上: "上 上 签",
  上吉: "上 吉 签",
  吉: "吉 签",
  平: "平 签",
  渐顺: "渐 顺 签",
  慎行: "慎 行 签",
};

const DEFAULT_CHIP = "bg-[var(--color-wuxing-water)]/25";
const DEFAULT_LABEL = "签";

/**
 * 抽签解读报告卡（V1.0 需求对齐）
 *
 * - 顶部：level 徽章 + 第 N 签 + 标题
 * - 中部：签诗（米黄底）
 * - 解签词（reading：DB 静态文本）
 * - AI 分段解读（sections：7 块 emoji 标签格式）
 *   有 sections 数据时分段展示，无则 fallback 到纯 aiInterpretation
 * - 部分解读时底部显示"我要完整解读"按钮
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
  className,
}: SlipReportCardProps) {
  const hasStructuredSections = sections && sections.length > 0;

  return (
    <div
      data-testid="slip-report-card"
      className={cn(
        "relative space-y-4 overflow-hidden rounded-[16px] border border-[#a87c5e]/30 p-5 shadow-[0_8px_24px_rgba(200,170,220,0.15)]",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, #FFF8E8 0%, #FCEFC8 100%)," +
          "repeating-linear-gradient(0deg, rgba(168,124,94,0.05) 0px, rgba(168,124,94,0.05) 1px, transparent 1px, transparent 6px)",
      }}
    >
      <header className="space-y-2 text-center">
        <span
          className={cn(
            "inline-block rounded-full border border-[var(--color-accent-lavender)]/40 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            LEVEL_CHIP[level] ?? DEFAULT_CHIP,
          )}
        >
          {LEVEL_LABEL[level] ?? DEFAULT_LABEL}
        </span>
        <h3
          className="font-[family-name:var(--font-calligraphy),var(--font-serif)] text-[22px] tracking-ritual text-[#7d2f2f]"
          data-testid="report-title"
        >
          第 {slipNumber} 签 · {title}
        </h3>
        <p className="text-[11px] tracking-ritual2 text-[var(--color-ink-fade)]">
          关 于 ·{" "}
          <span className="text-[var(--color-accent-plum)]">{dimension}</span>
        </p>
      </header>

      <div className="rounded-[12px] border border-[#a87c5e]/30 bg-[#FFF6E0]/85 px-4 py-4 shadow-inner">
        <p className="whitespace-pre-line text-center font-[family-name:var(--font-serif)] text-[16px] leading-loose tracking-ritual text-[var(--color-ink-plum)]">
          {poem}
        </p>
      </div>

      <Divider />

      <section className="space-y-1.5">
        <p className="text-[11px] tracking-ritual2 text-[#a87c5e]">解 签 词</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-plum)]">
          {reading}
        </p>
      </section>

      {/* AI 解读 — 结构化 sections 或 fallback 纯文本 */}
      {hasStructuredSections ? (
        <div data-testid="slip-sections" className="space-y-4">
          {sections.map((sec, i) => (
            <section key={i} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{sec.emoji}</span>
                <span className="text-[12px] font-medium tracking-ritual2 text-[var(--color-accent-plum)]">
                  {sec.label}
                </span>
              </div>
              {sec.shortReading && (
                <p className="text-sm font-medium leading-relaxed text-[var(--color-ink-plum)]">
                  {sec.shortReading}
                </p>
              )}
              {sec.longReading && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-plum)]/85">
                  {sec.longReading}
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="space-y-1.5">
          <p className="text-[11px] tracking-ritual2 text-[var(--color-accent-plum)]">
            AI 解 读
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-plum)]">
            {aiInterpretation}
          </p>
        </section>
      )}

      {/* 部分解读时显示"我要完整解读"按钮（会员锁定） */}
      {!isFullInterpret && onFullExplain && (
        <div className="flex justify-center pt-1">
          <MembershipGate feature="完整解读">
            <button
              type="button"
              onClick={onFullExplain}
              data-testid="btn-full-explain"
              className="rounded-full border border-[var(--color-accent-lavender)]/50 bg-[var(--color-accent-lavender)]/10 px-4 py-2 text-[13px] tracking-ritual2 text-[var(--color-accent-plum)] hover:bg-[var(--color-accent-lavender)]/25"
            >
              我要完整解读
            </button>
          </MembershipGate>
        </div>
      )}

      {/* 红朱方框落款印章 */}
      <div
        aria-hidden
        data-testid="report-seal"
        className="absolute bottom-3 right-3 flex h-9 w-9 flex-col items-center justify-center rounded-md border-[1.5px] border-[#a83333]/55"
        style={{
          color: "rgba(168,51,51,0.65)",
          fontFamily: "var(--font-serif)",
          lineHeight: 1,
        }}
      >
        <span className="text-[11px]">轻</span>
        <span className="text-[11px]">运</span>
      </div>

      {onShare && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onShare}
            className="rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/30 px-3 py-1.5 text-[12px] tracking-ritual2 text-[var(--color-ink-plum)] hover:bg-[var(--color-accent-lavender)]/20"
          >
            分享报告
          </button>
        </div>
      )}
    </div>
  );
}
