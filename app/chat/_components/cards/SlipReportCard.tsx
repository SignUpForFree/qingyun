"use client";
import * as React from "react";
import { Divider } from "@/components/su";
import { cn } from "@/lib/utils";
import type { SlipImageLevel } from "./SlipImageFullscreen";

export interface SlipReportCardProps {
  slipNumber: number;
  level: SlipImageLevel;
  title: string;
  poem: string;
  dimension: string;
  reading: string;
  aiInterpretation: string;
  onShare?: () => void;
  className?: string;
}

const LEVEL_CHIP: Record<SlipImageLevel, string> = {
  上上: "bg-[var(--color-wuxing-fire)]/35",
  上吉: "bg-[var(--color-wuxing-fire)]/25",
  中吉: "bg-[var(--color-wuxing-wood)]/25",
  中平: "bg-[var(--color-wuxing-water)]/25",
  下下: "bg-[var(--color-wuxing-earth)]/30",
};

const LEVEL_LABEL: Record<SlipImageLevel, string> = {
  上上: "上 上 签",
  上吉: "上 吉 签",
  中吉: "中 吉 签",
  中平: "中 平 签",
  下下: "下 下 签",
};

/**
 * 抽签解读报告卡（M2.12，spec §4.4 slip_report，image11）
 *
 * - 顶部：level 徽章 + 第 N 签 + 标题（书法字风 M4 加 Ma Shan Zheng）
 * - 中部：签诗（米黄底）
 * - 解签词（reading：DB 静态文本）
 * - AI 流式解读（aiInterpretation：动态生成，区别于 reading）
 * - 维度标签（dimension：抽签 6 维度其中之一）
 *
 * AI 解读和静态解签词分离展示，避免用户混淆"系统说"和"AI 说"。
 */
export function SlipReportCard({
  slipNumber,
  level,
  title,
  poem,
  dimension,
  reading,
  aiInterpretation,
  onShare,
  className,
}: SlipReportCardProps) {
  return (
    <div
      data-testid="slip-report-card"
      className={cn(
        "relative space-y-4 overflow-hidden rounded-[16px] border border-[#a87c5e]/30 p-5 shadow-[0_8px_24px_rgba(200,170,220,0.15)]",
        className,
      )}
      style={{
        // M4.23: 整卡米黄渐变 + 隐约纸纹（自画 repeating-linear-gradient）
        background:
          "linear-gradient(180deg, #FFF8E8 0%, #FCEFC8 100%)," +
          "repeating-linear-gradient(0deg, rgba(168,124,94,0.05) 0px, rgba(168,124,94,0.05) 1px, transparent 1px, transparent 6px)",
      }}
    >
      <header className="space-y-2 text-center">
        <span
          className={cn(
            "inline-block rounded-full border border-[var(--color-accent-lavender)]/40 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            LEVEL_CHIP[level],
          )}
        >
          {LEVEL_LABEL[level]}
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

      <section className="space-y-1.5">
        <p className="text-[11px] tracking-ritual2 text-[var(--color-accent-plum)]">
          AI 解 读
        </p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-plum)]">
          {aiInterpretation}
        </p>
      </section>

      {/* M4.23 红朱方框落款印章（右下角，避免遮 share 按钮） */}
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
