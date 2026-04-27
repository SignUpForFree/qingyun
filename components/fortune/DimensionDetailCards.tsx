import type { DailyDim7, DimensionScores7 } from "@/lib/fortune/daily-7dim";
import { DAILY_7_DIMS } from "@/lib/fortune/daily-7dim";

interface DimensionDetailCardsProps {
  scores: DimensionScores7;
  /** 整段 reading（来自 fortunes_daily.reading 或 AI），含【dim NN】分段头 */
  reading: string;
  /** 自定义顺序 */
  order?: ReadonlyArray<DailyDim7>;
}

/**
 * 7 维度详细卡 (M4.6, image3)
 *
 * 把 reading 全文按【dim NN】分段头切成 7 段，每段渲染一个细节卡：
 *   - 维度名 + 分数 + bar
 *   - 60-80 字解读正文
 *
 * reading 形如:
 *   "【爱情 75】今天感情运势...\n【财富 80】偏财...\n..."
 *
 * 切不出来时（AI 失败或格式偏差）仍渲染 7 卡，但正文显示完整 reading 第一段或 fallback 文案。
 */
export function DimensionDetailCards({ scores, reading, order }: DimensionDetailCardsProps) {
  const dims = order ?? DAILY_7_DIMS;
  const sections = parseReadingSections(reading);

  return (
    <div className="space-y-3" data-testid="dimension-detail-cards">
      {dims.map((dim) => {
        const v = scores[dim] ?? 60;
        const body = sections[dim] ?? "今天这个维度的解读暂时没生成。";
        return (
          <div
            key={dim}
            data-testid={`detail-card-${dim}`}
            className="rounded-2xl border border-[var(--color-accent-lavender)]/25 bg-[var(--color-paper)]/55 p-4"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[var(--color-ink-plum)]">
                {dim}
              </span>
              <span className="num-mono text-[12px] text-[var(--color-ink-mist)]">{v}</span>
            </div>
            <div className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-accent-lavender)]/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9]"
                style={{ width: `${clamp(v)}%` }}
              />
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-mist)]">{body}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 把整段 reading 按【dim NN】 头切成 dim → body 映射。
 * 兼容：分段间任意空白；body 截到下个【...】之前。
 */
export function parseReadingSections(reading: string): Partial<Record<DailyDim7, string>> {
  const out: Partial<Record<DailyDim7, string>> = {};
  if (!reading) return out;
  // 匹配【<dim> <NN>】 - dim 是 7 维度名之一
  const pattern = /【(爱情|财富|事业|学习|健康|人际|心情)\s+\d+】/g;
  const matches = [...reading.matchAll(pattern)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const dim = m[1] as DailyDim7;
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : reading.length;
    out[dim] = reading.slice(start, end).trim();
  }
  return out;
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}
