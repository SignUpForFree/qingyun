import Link from "next/link";
import { eq } from "drizzle-orm";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, WatercolorDot, Divider } from "@/components/su";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/profile/current";
import { getDb } from "@/lib/db/client";
import { baziCharts, fortunes } from "@/lib/db/schema";
import { getDayPillar } from "@/lib/bazi/today";
import { computeDailyScores } from "@/lib/fortune/scorer";
import { computeAttributes } from "@/lib/fortune/attributes";
import { pickOneLiner } from "@/lib/fortune/one-liner";
import { parseJson, serializeJson } from "@/lib/db/json";
import { DailyFortuneCard } from "@/components/fortune/DailyFortuneCard";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * 首页（spec §1）
 *
 * - 未建档 → 引导建档
 * - 已建档 → 今日运势 DailyFortuneCard（含 ScoreRing + 6 维度条 + 6 幸运属性）
 *
 * 运势计算入口同 /api/fortune/today，但服务端直接跑避免一次额外 RTT
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await safeGetProfile();
  const fortuneData = profile ? await loadOrComputeFortune(profile.id) : null;

  return (
    <>
      <AppHeader title="轻运 AI" />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[14%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
          <WatercolorDot color="blue" size={140} className="absolute bottom-[18%] left-[35%]" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          {!profile ? (
            <GlassCard className="space-y-4 p-7 text-center">
              <OnboardingPrompt />
            </GlassCard>
          ) : fortuneData ? (
            <DailyFortuneCard fortune={fortuneData} nickname={profile.nickname} />
          ) : (
            <GlassCard className="space-y-3 p-6 text-center">
              <p className="text-sm tracking-ritual2 text-[var(--color-ink-plum)]">
                八字还没排好 <Sparkle size={10} />
              </p>
              <p className="text-xs text-[var(--color-ink-fade)]">
                试着刷新一下，或重新建档
              </p>
              <Link href="/onboarding">
                <Button variant="outline">重新建档</Button>
              </Link>
            </GlassCard>
          )}
        </div>
      </div>
    </>
  );
}

function OnboardingPrompt() {
  return (
    <>
      <h1 className="text-[26px] tracking-ritual2 text-[var(--color-ink-plum)]">
        轻运 AI <Sparkle size={14} />
      </h1>
      <p className="text-sm text-[var(--color-ink-mist)]">
        先建一份档案，让 AI 知道你是谁
      </p>
      <Divider />
      <p className="text-xs leading-relaxed text-[var(--color-ink-fade)]">
        支持公历 / 农历，按真太阳时排盘。
        <br />
        档案只你自己可见，不分享给任何人。
      </p>
      <Link href="/onboarding" className="block">
        <Button className="h-12 w-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-white shadow-pill hover:opacity-90">
          开始建档
        </Button>
      </Link>
    </>
  );
}

async function safeGetProfile() {
  try {
    return await getCurrentProfile();
  } catch (e) {
    console.error("getCurrentProfile 失败", e);
    return null;
  }
}

async function loadOrComputeFortune(profileId: string) {
  try {
    const db = getDb();
    const dayPillar = getDayPillar();

    const cached = await db
      .select()
      .from(fortunes)
      .where(eq(fortunes.profile_id, profileId))
      .limit(50);
    const todayHit = cached.find((f) => f.fortune_date === dayPillar.date);
    if (todayHit) return hydrate(todayHit);

    const chartRow = await db
      .select()
      .from(baziCharts)
      .where(eq(baziCharts.profile_id, profileId))
      .limit(1);
    const chart = chartRow[0];
    if (!chart) return null;

    const fiveElements = parseJson<Record<Wuxing, number>>(chart.five_elements, {
      金: 0,
      木: 0,
      水: 0,
      火: 0,
      土: 0,
    });
    const scores = computeDailyScores(
      { dayMaster: chart.day_master, fiveElements },
      dayPillar,
    );
    const attributes = computeAttributes(dayPillar);
    const oneLiner = pickOneLiner(scores);

    const [inserted] = await db
      .insert(fortunes)
      .values({
        profile_id: profileId,
        fortune_date: dayPillar.date,
        score_overall: scores.overall,
        scores: serializeJson(scores.scores),
        one_liner: oneLiner,
        readings: serializeJson({ meta: scores.meta }),
        attributes: serializeJson(attributes),
        model: "static-fallback",
        tokens_used: 0,
      })
      .returning();

    return hydrate(inserted!);
  } catch (e) {
    console.error("loadOrComputeFortune 失败", e);
    return null;
  }
}

function hydrate(row: {
  id: string;
  fortune_date: string;
  score_overall: number | null;
  scores: string | null;
  one_liner: string | null;
  attributes: string | null;
}) {
  return {
    date: row.fortune_date,
    overall: row.score_overall ?? 0,
    scores: parseJson<Record<string, number>>(row.scores, {}),
    oneLiner: row.one_liner,
    attributes: parseJson(row.attributes, {}),
  };
}
