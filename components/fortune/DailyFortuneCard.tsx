import Link from "next/link";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { ScoreRing } from "./ScoreRing";

interface FortunePayload {
  date: string;
  overall: number;
  scores: Record<string, number>;
  oneLiner: string | null;
  attributes: {
    color?: { name: string; hex: string };
    direction?: string;
    hour?: { branch: string; range: string };
    number?: number;
    flower?: string;
    item?: string;
    accessory?: string;
    food?: string;
  };
}

interface DailyFortuneCardProps {
  fortune: FortunePayload;
  nickname?: string | null;
}

const DIM_ORDER = [
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

/**
 * 首页核心运势卡（spec §1 Home）
 *
 * - 顶部 ScoreRing 大圆环（综合运势）
 * - one-liner 一句话
 * - 5 维度细分（不含综合）水平条 — 新 6 类去掉综合
 * - 8 幸运属性 grid（色 / 方位 / 时辰 / 数字 / 花 / 物 / 配饰 / 食物）
 */
export function DailyFortuneCard({ fortune, nickname }: DailyFortuneCardProps) {
  const greeting = pickGreeting();
  const attrs = fortune.attributes;

  return (
    <GlassCard className="w-full max-w-md space-y-5 p-6">
      <div className="text-center">
        <p className="text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
          {greeting}{nickname ? `，${nickname}` : ""} <Sparkle size={9} />
        </p>
      </div>

      <div className="flex justify-center">
        <ScoreRing score={fortune.overall} size={170} />
      </div>

      {fortune.oneLiner && (
        <p className="px-2 text-center text-[13px] leading-relaxed text-[var(--color-ink-mist)]">
          {fortune.oneLiner}
        </p>
      )}

      <Divider />

      <DimensionBars scores={fortune.scores} />

      <Divider />

      <AttributesGrid attrs={attrs} />

      <Link
        href={`/fortune/${fortune.date}`}
        className="block text-center text-[11px] tracking-ritual2 text-[var(--color-accent-plum)] hover:underline"
      >
        看 详 细 解 读 →
      </Link>
    </GlassCard>
  );
}

function DimensionBars({ scores }: { scores: Record<string, number> }) {
  return (
    <div className="space-y-2.5">
      {DIM_ORDER.map((dim) => {
        const v = scores[dim] ?? 60;
        return (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[11px] tracking-ritual text-[var(--color-ink-mist)]">
              {dim}
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-accent-lavender)]/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] transition-[width] duration-500"
                style={{ width: `${v}%` }}
              />
            </div>
            <span className="num-mono w-7 shrink-0 text-right text-[11px] text-[var(--color-ink-mist)]">
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AttributesGrid({ attrs }: { attrs: DailyFortuneCardProps["fortune"]["attributes"] }) {
  const items: Array<{ label: string; value: string; tone?: string }> = [
    { label: "幸运色", value: attrs.color?.name ?? "—", tone: attrs.color?.hex },
    { label: "幸运方位", value: attrs.direction ?? "—" },
    { label: "幸运时辰", value: attrs.hour?.range ?? "—" },
    { label: "幸运数", value: String(attrs.number ?? "—") },
    { label: "幸运花", value: attrs.flower ?? "—" },
    { label: "随身物", value: attrs.item ?? "—" },
    { label: "配饰", value: attrs.accessory ?? "—" },
    { label: "食物", value: attrs.food ?? "—" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <div key={it.label} className="text-center">
          <p className="text-[10px] tracking-ritual text-[var(--color-ink-fade)]">{it.label}</p>
          <p
            className="mt-1 font-[family-name:var(--font-serif)] text-[13px] leading-tight text-[var(--color-ink-plum)]"
            style={it.tone ? { textShadow: `0 0 8px ${it.tone}88` } : undefined}
          >
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function pickGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  if (h < 22) return "傍晚好";
  return "夜里好";
}
