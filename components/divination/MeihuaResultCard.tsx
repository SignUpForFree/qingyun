import { GlassCard, Sparkle, Divider } from "@/components/su";
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
  className?: string;
}

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
  className,
}: MeihuaResultCardProps) {
  return (
    <GlassCard className={cn("space-y-4 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          梅 花 易 数 · V 1.0
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            "border border-[var(--color-accent-lavender)]/40",
            relationChipBg(relation),
          )}
        >
          {verdict}
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cell label="本 卦" view={ben} />
        <Cell label="互 卦" view={hu} />
        <Cell label="变 卦" view={bian} />
        <Cell label="卦 中 卦" view={guaZhongGua} />
      </div>

      <Divider />

      <div className="space-y-1.5 text-center text-[12px] text-[var(--color-ink-mist)]">
        <p>
          体 ={" "}
          <span className="tracking-ritual text-[var(--color-accent-plum)]">
            {ti}（{TRIGRAM_WUXING[ti] ?? "?"}）
          </span>
          ，用 ={" "}
          <span className="tracking-ritual text-[var(--color-accent-plum)]">
            {yong}（{TRIGRAM_WUXING[yong] ?? "?"}）
          </span>
        </p>
        <p>
          动 爻 第{" "}
          <span className="num-mono text-[var(--color-ink-plum)]">{dongYao}</span> 爻 ·
          应 期 {timeHint}
          {branchHour ? ` · ${branchHour}` : ""}
        </p>
      </div>
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
