"use client";
import { DivinationReadingSection } from "@/components/divination/DivinationReadingSection";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";
import { wuxingOf } from "@/lib/bazi/stems-branches";
import type { BaziPillars, BaziTenGods } from "@/types/domain";
import type { Wuxing, Stem, Branch } from "@/lib/bazi/stems-branches";

interface BaziChartView {
  pillars: BaziPillars;
  fiveElements: Record<Wuxing, number>;
  dayMaster: string;
  tenGods: BaziTenGods;
  currentLuck: string;
  /** 喜用神数组（spec design §8 第 521 行）；缺则展示日主 + 当前大运 */
  favorableGods?: ReadonlyArray<Wuxing>;
}

interface BaziResultCardProps {
  chart: BaziChartView;
  focus: string;
  aiText: string;
  /** 解读区流式输出中（命盘已展示） */
  readingStreaming?: boolean;
  /** 命主称呼，default "命 主"。可填档案 nickname */
  ownerLabel?: string;
  /** 命盘小标题（如"丁丑年 三月初七 辰时"），缺则隐藏 */
  birthSummary?: string;
  /** 解释 CTA 点击事件；空则不渲染 */
  onExplain?: () => void;
  className?: string;
}

const WUXING_TONE: Record<Wuxing, { color: string; bgGlow: string; cn: string }> = {
  金: {
    color: "var(--color-wuxing-metal)",
    bgGlow: "rgba(232,212,232,0.55)",
    cn: "金",
  },
  木: {
    color: "var(--color-wuxing-wood)",
    bgGlow: "rgba(191,217,194,0.55)",
    cn: "木",
  },
  水: {
    color: "var(--color-wuxing-water)",
    bgGlow: "rgba(164,184,232,0.55)",
    cn: "水",
  },
  火: {
    color: "var(--color-wuxing-fire)",
    bgGlow: "rgba(240,184,200,0.55)",
    cn: "火",
  },
  土: {
    color: "var(--color-wuxing-earth)",
    bgGlow: "rgba(232,201,164,0.55)",
    cn: "土",
  },
};

/**
 * 八字排盘卡（design §8 BaziChart Card · in-chat）
 *
 * 视觉还原（素笺仙气）：
 * - 顶部 "命 盘"（serif 13px ritual2）+ 命主小字
 * - 4 柱列：年/月/日/时；每列：
 *   · top label "年柱"（lavender 10px）
 *   · 天干大字 24px serif + 后水彩 glow 按五行染色
 *   · 地支大字 20px serif
 *   · 十神 9px sans muted（日柱标"日主"）
 * - 五行分布水平 stack bar：金/木/水/火/土 段宽 = count，色按五行
 * - 日主 + 喜用神 一行：plum + lavender 软背景 badge
 * - CTA "读 · 细 说 命 盘"（lavender→pink 渐变全宽 12px rounded）
 *
 * 数据：
 * - chart.pillars / fiveElements / dayMaster / tenGods 由 buildChart 算出
 * - chart.favorableGods (Wuxing[]) optional；M3 算法升级后填充
 */
export function BaziResultCard({
  chart,
  focus,
  aiText,
  readingStreaming = false,
  ownerLabel = "命 主",
  birthSummary,
  onExplain,
  className,
}: BaziResultCardProps) {
  const order: Wuxing[] = ["金", "木", "水", "火", "土"];
  const totalElements = order.reduce((s, w) => s + (chart.fiveElements[w] ?? 0), 0) || 1;
  const dayMasterWx = wuxingOf(chart.dayMaster as Stem);

  return (
    <GlassCard
      className={cn("space-y-4 p-5", className)}
      data-testid="bazi-result-card"
    >
      {/* HEADER */}
      <header className="space-y-1 text-center">
        <p className="font-[family-name:var(--font-serif)] text-[13px] tracking-ritual2 text-[var(--color-ink-plum)]">
          命 盘
        </p>
        <p className="text-[11px] tracking-ritual text-[var(--color-accent-plum)]">
          八字 · {focus}
        </p>
        {(ownerLabel || birthSummary) && (
          <p className="text-[10px] text-[var(--color-ink-fade)]">
            {ownerLabel ?? "命 主"}
            {birthSummary ? ` · ${birthSummary}` : ""}
          </p>
        )}
      </header>

      {/* 4 柱 row */}
      <div className="grid grid-cols-4 gap-2" data-testid="bazi-pillars">
        {(["year", "month", "day", "hour"] as const).map((k) => {
          const p = chart.pillars[k];
          if (!p) return null;
          const stemWx = wuxingOf(p.gan as Stem);
          const branchWx = wuxingOf(p.zhi as Branch);
          const isDay = k === "day";
          const tenGodLabel = isDay
            ? "日 主"
            : k === "year"
              ? chart.tenGods?.year ?? ""
              : k === "month"
                ? chart.tenGods?.month ?? ""
                : chart.tenGods?.hour ?? "";
          const labelMap = { year: "年 柱", month: "月 柱", day: "日 柱", hour: "时 柱" };
          return (
            <div
              key={k}
              className={cn(
                "relative overflow-hidden rounded-[12px] border px-1 py-2 text-center",
                isDay
                  ? "border-[var(--color-accent-plum)]/40 bg-white/60"
                  : "border-[var(--color-accent-lavender)]/30 bg-white/30",
              )}
              data-testid={`bazi-pillar-${k}`}
            >
              {/* 干支水彩 glow */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(circle at center, ${WUXING_TONE[stemWx].bgGlow} 0%, transparent 65%)`,
                  opacity: 0.7,
                  filter: "blur(2px)",
                }}
              />
              <p className="relative text-[10px] tracking-ritual2 text-[var(--color-accent-lavender)]">
                {labelMap[k]}
              </p>
              <p
                className="relative font-[family-name:var(--font-serif)] text-[24px] leading-tight text-[var(--color-ink-plum)]"
                style={{ color: WUXING_TONE[stemWx].color }}
              >
                {p.gan}
              </p>
              <p
                className="relative font-[family-name:var(--font-serif)] text-[20px] leading-tight text-[var(--color-ink-plum)]"
                style={{ color: WUXING_TONE[branchWx].color }}
              >
                {p.zhi}
              </p>
              <p className="relative mt-0.5 text-[9px] tracking-ritual2 text-[var(--color-ink-fade)]">
                {tenGodLabel}
              </p>
            </div>
          );
        })}
      </div>

      {/* 五行分布 stack bar */}
      <div className="space-y-1.5" data-testid="bazi-fiveelements">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/40">
          {order.map((w) => {
            const c = chart.fiveElements[w] ?? 0;
            if (c === 0) return null;
            return (
              <span
                key={w}
                aria-label={`${w} ${c}`}
                style={{
                  width: `${(c / totalElements) * 100}%`,
                  background: WUXING_TONE[w].color,
                  opacity: 0.85,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] font-[family-name:var(--font-serif)]">
          {order.map((w) => (
            <span
              key={w}
              className="flex flex-col items-center gap-0.5"
              style={{ color: WUXING_TONE[w].color }}
            >
              <span>{w}</span>
              <span className="num-mono text-[9px] text-[var(--color-ink-fade)]">
                {chart.fiveElements[w] ?? 0}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 日主 + 喜用神 一行 + lavender 软背景 */}
      <div className="rounded-[10px] bg-[var(--color-accent-lavender)]/15 px-3 py-2 text-center">
        <p className="font-[family-name:var(--font-serif)] text-[12px] tracking-ritual text-[var(--color-ink-plum)]">
          日 主：
          <span className="text-[var(--color-accent-plum)]">
            {chart.dayMaster} {dayMasterWx}
          </span>
          {chart.favorableGods && chart.favorableGods.length > 0 ? (
            <>
              {" · "}
              喜 用 神：
              <span className="text-[var(--color-accent-plum)]">
                {chart.favorableGods.join("、")}
              </span>
            </>
          ) : (
            <>
              {" · "}
              当 前 大 运：
              <span className="text-[var(--color-accent-plum)]">{chart.currentLuck}</span>
            </>
          )}
        </p>
      </div>

      <DivinationReadingSection aiText={aiText} readingStreaming={readingStreaming}>
        {aiText.trim() ? (
          <p className="whitespace-pre-wrap text-[13px] leading-[1.85] text-[var(--color-ink-plum)]">
            {aiText}
          </p>
        ) : null}
      </DivinationReadingSection>

      {/* CTA */}
      {onExplain && (
        <button
          type="button"
          onClick={onExplain}
          className="h-11 w-full rounded-[12px] bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-white shadow-pill transition-opacity hover:opacity-90"
          data-testid="bazi-explain-cta"
        >
          读 · 细 说 命 盘
        </button>
      )}
    </GlassCard>
  );
}
