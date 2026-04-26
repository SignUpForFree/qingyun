import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider, WatercolorDot } from "@/components/su";
import { Button } from "@/components/ui/button";
import { DailyFortuneCard } from "@/components/fortune/DailyFortuneCard";
import { getCurrentProfile } from "@/lib/profile/current";
import {
  isValidDateStr,
  loadFortuneByDate,
  todayDateStr,
} from "@/lib/fortune/load";

/**
 * /fortune/[date] 详情页（spec D7）
 *
 * - date 形如 YYYY-MM-DD
 * - 走 RSC，缓存命中 / 当天首次访问会写库
 * - 历史日期无缓存 → 显示空态卡（不补历史运势）
 * - 显示 DailyFortuneCard + 维度细解 + 五行说明 + 时辰建议
 */
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ date: string }>;
}

export default async function FortuneDetailPage({ params }: PageProps) {
  const { date } = await params;
  if (!isValidDateStr(date)) notFound();

  const profile = await safeGetProfile();
  if (!profile) {
    return <NoProfileShell />;
  }

  const fortune = await loadFortuneByDate(profile.id, date);
  const today = todayDateStr();
  const isToday = date === today;
  const isFuture = date > today;
  const isPast = date < today;

  return (
    <>
      <AppHeader
        title={isToday ? "今日详 解" : formatDateLabel(date)}
        left={<BackHome />}
      />
      <div className="relative flex flex-1 flex-col items-center gap-5 overflow-x-hidden px-4 pb-20 pt-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={120} className="absolute left-[6%] top-[8%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[6%] top-[28%]" />
        </div>

        <div className="relative z-10 w-full max-w-md space-y-4">
          {fortune ? (
            <>
              <DailyFortuneCard fortune={fortune} nickname={profile.nickname} />
              <ReadingsCard
                date={fortune.date}
                scores={fortune.scores}
                oneLiner={fortune.oneLiner}
              />
              <AttributesAdvice
                attrs={fortune.attributes}
              />
            </>
          ) : (
            <EmptyShell isFuture={isFuture} isPast={isPast} date={date} />
          )}
        </div>
      </div>
    </>
  );
}

function BackHome() {
  return (
    <Link
      href="/"
      className="text-sm text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
      aria-label="返回首页"
    >
      ←
    </Link>
  );
}

function formatDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
}

function ReadingsCard({
  scores,
  oneLiner,
}: {
  date: string;
  scores: Record<string, number>;
  oneLiner: string | null;
}) {
  const ranked = Object.entries(scores)
    .filter(([dim]) => dim !== "综合")
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];

  return (
    <GlassCard className="space-y-3 p-5">
      <h2 className="text-center text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
        维 度 细 解 <Sparkle size={9} />
      </h2>
      <Divider />
      {oneLiner && (
        <p className="text-center text-[13px] leading-relaxed text-[var(--color-ink-mist)]">
          {oneLiner}
        </p>
      )}
      <div className="space-y-2 pt-1 text-sm leading-relaxed text-[var(--color-ink-plum)]">
        {top && (
          <p>
            <span className="tracking-ritual text-[var(--color-accent-plum)]">{top[0]}</span>{" "}
            是今日能量最足的方向（{top[1]} 分），可以把要紧的事推一步。
          </p>
        )}
        {bottom && bottom[0] !== top?.[0] && (
          <p>
            <span className="tracking-ritual text-[var(--color-accent-plum)]">{bottom[0]}</span>{" "}
            可以慢一点（{bottom[1]} 分），别给自己加额外压力。
          </p>
        )}
      </div>
    </GlassCard>
  );
}

function AttributesAdvice({
  attrs,
}: {
  attrs: {
    color?: { name: string; hex: string };
    direction?: string;
    hour?: { branch: string; range: string };
    flower?: string;
    item?: string;
    number?: number;
  };
}) {
  return (
    <GlassCard className="space-y-3 p-5">
      <h2 className="text-center text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
        今 日 调 度 <Sparkle size={9} variant="diamond" />
      </h2>
      <Divider />
      <div className="space-y-2 text-sm leading-relaxed text-[var(--color-ink-plum)]">
        {attrs.color && (
          <p>
            穿一点{" "}
            <span
              className="rounded-full px-2 py-0.5"
              style={{ background: `${attrs.color.hex}33` }}
            >
              {attrs.color.name}
            </span>{" "}
            会更顺。
          </p>
        )}
        {attrs.direction && (
          <p>
            出门优先朝{" "}
            <span className="tracking-ritual text-[var(--color-accent-plum)]">
              {attrs.direction}
            </span>{" "}
            方向，能借到当天的气运。
          </p>
        )}
        {attrs.hour && (
          <p>
            最适合做要紧事的是{" "}
            <span className="tracking-ritual text-[var(--color-accent-plum)]">
              {attrs.hour.branch} 时（{attrs.hour.range}）
            </span>
            。
          </p>
        )}
        {attrs.flower && (
          <p>
            如果想沾点运气，桌上摆一支{" "}
            <span className="tracking-ritual text-[var(--color-accent-plum)]">{attrs.flower}</span>
            。
          </p>
        )}
        {attrs.item && (
          <p>
            随身带{" "}
            <span className="tracking-ritual text-[var(--color-accent-plum)]">{attrs.item}</span>
            ，作为今天的小提醒。
          </p>
        )}
      </div>
    </GlassCard>
  );
}

function EmptyShell({
  isFuture,
  isPast,
  date,
}: {
  isFuture: boolean;
  isPast: boolean;
  date: string;
}) {
  return (
    <GlassCard className="space-y-3 p-7 text-center">
      <p className="text-sm tracking-ritual text-[var(--color-ink-plum)]">
        {isFuture
          ? `${date} 还没到，到那天再来看吧`
          : isPast
            ? `${date} 没有运势记录`
            : "暂无运势"}{" "}
        <Sparkle size={10} />
      </p>
      <p className="text-xs leading-relaxed text-[var(--color-ink-fade)]">
        历史运势不会回填 — 每天来看一眼，运气会一点点存起来
      </p>
      <Link href="/">
        <Button variant="outline">回 今 日</Button>
      </Link>
    </GlassCard>
  );
}

function NoProfileShell() {
  return (
    <>
      <AppHeader title="详 解" />
      <div className="flex flex-1 items-center justify-center px-4 pb-20 pt-4">
        <GlassCard className="w-full max-w-sm space-y-3 p-7 text-center">
          <p className="text-sm tracking-ritual text-[var(--color-ink-plum)]">
            还没建档，看不了详解 <Sparkle size={10} />
          </p>
          <Link href="/onboarding">
            <Button className="bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] text-white">
              先去建档 →
            </Button>
          </Link>
        </GlassCard>
      </div>
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
