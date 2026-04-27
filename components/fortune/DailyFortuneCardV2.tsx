import Link from "next/link";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { ScoreRing } from "./ScoreRing";
import { DimensionBars7 } from "./DimensionBars7";
import { AttributesGrid8 } from "./AttributesGrid8";
import { LauncherGrid } from "./LauncherGrid";
import type { DimensionScores7 } from "@/lib/fortune/daily-7dim";
import type { Attributes } from "@/lib/fortune/attributes";

interface FortunePayload {
  date: string;
  overall: number;
  scores: DimensionScores7;
  oneLiner: string | null;
  attributes: Partial<Attributes>;
}

interface DailyFortuneCardV2Props {
  fortune: FortunePayload;
  nickname?: string | null;
}

/**
 * 首页核心运势卡 V2 (M4.1, image2)
 *
 * V1 5 维度 → V2 7 维度（爱情/财富/事业/学习/健康/人际/心情）。
 * 容器布局：
 *   1. 顶部问候 "哈喽，{nickname} ✨"（按时辰渐变）
 *   2. ScoreRing 综合分（170px）
 *   3. one-liner 一句话
 *   4. DimensionBars7（7 横条）
 *   5. AttributesGrid8（4×2 lucky cell）
 *   6. LauncherGrid（4 入口跳 /chat?intent=）
 *   7. 详细解读链接 → /fortune/[date]
 */
export function DailyFortuneCardV2({ fortune, nickname }: DailyFortuneCardV2Props) {
  return (
    <GlassCard className="w-full max-w-md space-y-5 p-6">
      <div className="text-center">
        <p className="text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
          哈喽{nickname ? `，${nickname}` : ""} <Sparkle size={9} />
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

      <DimensionBars7 scores={fortune.scores} />

      <Divider />

      <AttributesGrid8 attrs={fortune.attributes} />

      <Divider />

      <LauncherGrid />

      <Link
        href={`/fortune/${fortune.date}`}
        className="block text-center text-[11px] tracking-ritual2 text-[var(--color-accent-plum)] hover:underline"
      >
        看 详 细 解 读 →
      </Link>
    </GlassCard>
  );
}
