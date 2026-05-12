"use client";
import * as React from "react";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";
import { chineseSignature } from "@/lib/util/cn-numerals";
import type { SlipLevel } from "@/db/seed/slips-v2";

interface SlipResultCardProps {
  number: number;
  level: SlipLevel;
  title: string;
  poem: string;
  reading: string;
  dimension: string;
  /** 6 维度全量 reading（design §7 6 tabs）；未提供时仅展示当前 dimension */
  readings?: Partial<Record<SlipDimensionKey, string>>;
  className?: string;
}

const DIM_TABS = [
  "综合",
  "事业",
  "财运",
  "感情",
  "人际",
  "健康",
] as const;
type SlipDimensionKey = (typeof DIM_TABS)[number];

const LEVEL_TONE: Record<
  SlipLevel,
  { chip: string; label: string; glow: string }
> = {
  上上: {
    chip: "bg-gradient-to-br from-[#F7C9D6] to-[#F0B8C8] border-[#E8B0C0]/60",
    label: "上 上",
    glow: "rgba(240,184,200,0.5)",
  },
  上吉: {
    chip: "bg-gradient-to-br from-[#FBD9C4] to-[#F0B8C8] border-[#E8B5A0]/60",
    label: "上 吉",
    glow: "rgba(232,181,160,0.45)",
  },
  吉: {
    chip: "bg-gradient-to-br from-[#FBE9C2] to-[#F2D9A0] border-[#E0C880]/60",
    label: "吉",
    glow: "rgba(240,210,140,0.4)",
  },
  平: {
    chip: "bg-gradient-to-br from-[#E8D4E8] to-[#C9C0E0] border-[#B8A8D8]/60",
    label: "平",
    glow: "rgba(201,161,217,0.45)",
  },
  渐顺: {
    chip: "bg-gradient-to-br from-[#C9E0F0] to-[#A4B8E8] border-[#94A8D8]/60",
    label: "渐 顺",
    glow: "rgba(164,184,232,0.4)",
  },
  慎行: {
    chip: "bg-gradient-to-br from-[#E0CCC4] to-[#B8A8B8] border-[#A89AB0]/60",
    label: "慎 行",
    glow: "rgba(166,154,184,0.4)",
  },
};

const DEFAULT_TONE = { chip: "bg-gradient-to-br from-[#E8D4E8] to-[#C9C0E0] border-[#B8A8D8]/60", label: "签", glow: "rgba(201,161,217,0.45)" };

/**
 * 灵签结果卡（spec §6 抽签 + design prompts §7 SlipResultCard）
 *
 * 视觉还原（素笺仙气）：
 * - 顶部：签号大字（"第 八 · 十 · 六 签"，serif 15px 紫雾间距 0.2em）+ 等级 pill 右
 * - 签题居中（serif 20px 墨梅 + ✧ 左右装饰）
 * - 签文 4 行（serif 15px line-height 2.2）+ 下方水彩光晕
 * - ✦ Divider
 * - 6 维度 tabs（综合/事业/财运/感情/人际/健康），lavender 下划线 active
 * - Reading 段首 ✦ 标记（13px sans / leading-1.85）
 *
 * 单维度兼容：未传 readings 时 fallback 到 reading prop 单显示，无 tabs。
 */
export function SlipResultCard({
  number,
  level,
  title,
  poem,
  reading,
  dimension,
  readings,
  className,
}: SlipResultCardProps) {
  const tone = LEVEL_TONE[level] ?? DEFAULT_TONE;
  const sigCn = chineseSignature(number);
  const poemLines = React.useMemo(
    () =>
      poem
        .split(/[\n，。！？]+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 4),
    [poem],
  );

  const initialTab: SlipDimensionKey = (() => {
    const found = DIM_TABS.find((d) => dimension.includes(d));
    return found ?? "综合";
  })();
  const [activeTab, setActiveTab] = React.useState<SlipDimensionKey>(initialTab);

  const activeReading = readings?.[activeTab] ?? reading;
  const hasMultipleReadings = readings && Object.keys(readings).length > 0;

  return (
    <GlassCard className={cn("space-y-4 p-6", className)} data-testid="slip-result-card">
      {/* HEADER：签号左 + level pill 右 */}
      <div className="flex items-start justify-between gap-3">
        <span
          className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-mist)]"
          data-testid="slip-signature"
        >
          第 <span className="text-[var(--color-ink-plum)]">{sigCn}</span> 签
        </span>
        <span
          className={cn(
            "rounded-[10px] border px-2.5 py-0.5",
            "font-[family-name:var(--font-serif)] text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            tone.chip,
          )}
          data-testid="slip-level-pill"
        >
          {tone.label}
        </span>
      </div>

      {/* SLIP TITLE 居中 + ✧ 左右 */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <Sparkle size={10} variant="asterisk" />
        <h2
          className="font-[family-name:var(--font-serif)] text-[20px] tracking-ritual2 text-[var(--color-ink-plum)]"
          data-testid="slip-title"
        >
          {title.split("").join(" ")}
        </h2>
        <Sparkle size={10} variant="asterisk" />
      </div>

      {/* POEM BLOCK + 水彩光晕 */}
      <div className="relative px-2 py-3">
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: "20%",
            right: "20%",
            top: "30%",
            bottom: "30%",
            background: tone.glow,
            filter: "blur(24px)",
            opacity: 0.6,
          }}
        />
        <div className="relative space-y-1.5 text-center" data-testid="slip-poem">
          {poemLines.map((line, i) => (
            <p
              key={i}
              className="font-[family-name:var(--font-serif)] text-[15px] tracking-[0.15em] leading-[2.2] text-[var(--color-ink-plum)]"
            >
              {line.split("").join(" ")}
            </p>
          ))}
        </div>
      </div>

      {/* ✦ DIVIDER */}
      <div className="flex items-center justify-center gap-2">
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-accent-lavender)]/30 to-transparent"
        />
        <Sparkle size={10} variant="diamond" />
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-accent-lavender)]/30 to-transparent"
        />
      </div>

      {/* 6 DIMENSION TABS（仅多维 readings 时） */}
      {hasMultipleReadings ? (
        <div
          role="tablist"
          className="flex justify-around"
          data-testid="slip-dim-tabs"
        >
          {DIM_TABS.map((d) => {
            const isActive = d === activeTab;
            const has = Boolean(readings?.[d]);
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={!has}
                onClick={() => has && setActiveTab(d)}
                className={cn(
                  "px-1.5 pb-1 font-[family-name:var(--font-serif)] text-[11px] tracking-ritual2 transition-colors",
                  isActive
                    ? "text-[var(--color-ink-plum)] border-b-2 border-[var(--color-accent-lavender)]"
                    : "text-[var(--color-ink-fade)] border-b-2 border-transparent",
                  !has && "opacity-30 cursor-not-allowed",
                )}
                data-testid={`slip-dim-${d}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          关 于 ·{" "}
          <span className="text-[var(--color-accent-plum)]">{dimension}</span>
        </p>
      )}

      {/* READING + ✦ 段首标记 */}
      <div className="space-y-2 px-1" data-testid="slip-reading">
        <p className="text-[13px] leading-[1.85] text-[var(--color-ink-plum)]">
          <Sparkle size={10} variant="diamond" className="mr-1" />
          {activeReading}
        </p>
      </div>
    </GlassCard>
  );
}
