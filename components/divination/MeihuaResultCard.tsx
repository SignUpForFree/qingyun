import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

/**
 * 梅花结果卡（设计 §6 MeihuaResultCard，参考 mockup
 * docs/superpowers/designs/meihua-result-card-20260424/a-refined-fairy.html）
 *
 * - 顶部 verdict chip + 应期 timeHint
 * - 4 宫格：本/互/变/卦中卦
 *   每格：八卦 unicode 大字 + 卦名 + 五行标签 + 五行 watercolor glow
 * - 底部 体用 row + 动爻位
 *
 * 完全无 AI 解读 — 解读以独立 message（meihua_reading）展示在卡下方
 */

const TRIGRAM_UNICODE: Record<string, string> = {
  乾: "☰",
  兑: "☱",
  离: "☲",
  震: "☳",
  巽: "☴",
  坎: "☵",
  艮: "☶",
  坤: "☷",
};

const TRIGRAM_WUXING: Record<string, string> = {
  乾: "金",
  兑: "金",
  离: "火",
  震: "木",
  巽: "木",
  坎: "水",
  艮: "土",
  坤: "土",
};

// 五行 watercolor glow（呼应 fortune attributes 的色板）
const GLOW_BY_WUXING: Record<string, string> = {
  金: "#E8D4E8",
  木: "#BFD9C2",
  水: "#A4B8E8",
  火: "#F0B8C8",
  土: "#E8C9A4",
};

interface HexagramView {
  number: number;
  name: string;
  upper: string;
  lower: string;
}

interface MeihuaResultCardProps {
  ben: HexagramView;
  hu: HexagramView;
  bian: HexagramView;
  guaZhongGua: HexagramView;
  dongYao: number;
  ti: string;
  yong: string;
  relation: string;
  verdict: string;
  speed: "fast" | "medium" | "slow";
  timeHint: string;
  branchHour: string | null;
  aiText?: string;
  className?: string;
}

// 动爻数字→中文（design mockup "第 二 爻"）
const YAO_CN: Record<number, string> = {
  1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六",
};

export function MeihuaResultCard({
  ben,
  hu,
  bian,
  guaZhongGua,
  dongYao,
  ti,
  yong,
  relation,
  verdict,
  timeHint,
  branchHour,
  aiText,
  className,
}: MeihuaResultCardProps) {
  const tiWx = TRIGRAM_WUXING[ti] ?? "?";
  const yongWx = TRIGRAM_WUXING[yong] ?? "?";
  const yaoCn = YAO_CN[dongYao] ?? String(dongYao);

  return (
    <GlassCard
      className={cn("space-y-4 p-5", className)}
      data-testid="meihua-result-card"
    >
      {/* TITLE：✧ 你 抽 到 的 梅 花 卦 ✧（mockup m-title） */}
      <div className="flex items-center justify-center gap-2">
        <Sparkle size={10} variant="asterisk" />
        <h2
          className="font-[family-name:var(--font-serif)] text-[16px] tracking-ritual2 text-[var(--color-ink-plum)]"
          data-testid="meihua-title"
        >
          你 抽 到 的 梅 花 卦
        </h2>
        <Sparkle size={10} variant="asterisk" />
      </div>

      {/* 4 卦 grid */}
      <div className="grid grid-cols-2 gap-3" data-testid="meihua-grid">
        <Cell label="本 卦" view={ben} />
        <Cell label="互 卦" view={hu} />
        <Cell label="变 卦" view={bian} />
        <Cell label="卦 中 卦" view={guaZhongGua} />
      </div>

      {/* ✦ Divider */}
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

      {/* META rows（动爻 / 体·上卦 / 用·下卦），mockup 风格 */}
      <div className="space-y-1.5 text-center text-[12px]" data-testid="meihua-meta">
        <p>
          <span className="tracking-ritual2 text-[var(--color-ink-fade)]">动 爻</span>{" "}
          <span className="font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]">
            第 {yaoCn} 爻
          </span>
        </p>
        <p>
          <span className="tracking-ritual2 text-[var(--color-ink-fade)]">体 · 上卦</span>{" "}
          <span className="font-[family-name:var(--font-serif)] text-[var(--color-accent-plum)]">
            {ti}（{tiWx}）
          </span>
          <span className="mx-2 text-[var(--color-ink-fade)]">·</span>
          <span className="tracking-ritual2 text-[var(--color-ink-fade)]">用 · 下卦</span>{" "}
          <span className="font-[family-name:var(--font-serif)] text-[var(--color-accent-plum)]">
            {yong}（{yongWx}）
          </span>
        </p>
      </div>

      {/* VERDICT 居中（mockup m-verdict-wrap） */}
      <div className="flex justify-center">
        <span
          className={cn(
            "rounded-full px-4 py-1.5 font-[family-name:var(--font-serif)] text-[13px] tracking-ritual text-[var(--color-ink-plum)]",
            "border border-[var(--color-accent-lavender)]/40 shadow-[0_2px_8px_rgba(200,170,220,0.15)]",
            relationChipBg(relation),
          )}
          data-testid="meihua-verdict"
        >
          {verdict}
        </span>
      </div>

      {/* TIMING ☷ 应期 */}
      <p
        className="text-center text-[11px] tracking-ritual2 text-[var(--color-ink-mist)]"
        data-testid="meihua-timing"
      >
        <span className="mr-1.5 text-[var(--color-accent-lavender)]">☷</span>
        应 期 · {timeHint}
        {branchHour ? ` · ${branchHour}` : ""}
      </p>

      {/* AI 解读 */}
      {aiText && (
        <p className="whitespace-pre-wrap text-[13px] leading-[1.85] text-[var(--color-ink-plum)]">
          <Sparkle size={10} variant="diamond" className="mr-1" />
          {aiText}
        </p>
      )}
    </GlassCard>
  );
}

function Cell({ label, view }: { label: string; view: HexagramView }) {
  const upperWx = TRIGRAM_WUXING[view.upper] ?? "土";
  const lowerWx = TRIGRAM_WUXING[view.lower] ?? "土";
  // 用上卦五行作为主 glow 色（mockup 大格规则）
  const glow = GLOW_BY_WUXING[upperWx] ?? "#E8D4E8";
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/30 px-3 py-3 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(circle at center, ${glow}55 0%, transparent 70%)`,
        }}
      />
      <p className="relative text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
        {label}
      </p>
      <div className="relative my-1 leading-tight font-[family-name:var(--font-serif)] text-[26px] text-[var(--color-ink-plum)]">
        {TRIGRAM_UNICODE[view.upper] ?? "?"}
        <br />
        {TRIGRAM_UNICODE[view.lower] ?? "?"}
      </div>
      <p className="relative font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[var(--color-ink-plum)]">
        {view.name}
      </p>
      <p className="relative mt-0.5 text-[10px] text-[var(--color-ink-fade)]">
        {upperWx} · {lowerWx}
      </p>
    </div>
  );
}

function relationChipBg(relation: string): string {
  switch (relation) {
    case "yong_sheng_ti":
      return "bg-[var(--color-wuxing-fire)]/30"; // 大吉，胭脂粉
    case "ti_ke_yong":
      return "bg-[var(--color-wuxing-wood)]/30"; // 吉，新柳绿
    case "bi_he":
      return "bg-[var(--color-wuxing-water)]/25"; // 平顺，雾烟蓝
    case "ti_sheng_yong":
      return "bg-[var(--color-wuxing-earth)]/25"; // 略耗，杏沙黄
    case "yong_ke_ti":
      return "bg-[var(--color-wuxing-metal)]/25"; // 留神，象牙白
    default:
      return "";
  }
}
