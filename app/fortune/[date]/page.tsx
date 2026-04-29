import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { GlassCard, WatercolorDot } from "@/components/su";
import { DimensionBars7Vertical } from "@/components/fortune/DimensionBars7Vertical";
import { AttributesGrid8 } from "@/components/fortune/AttributesGrid8";
import { FortuneReadingsBlock } from "@/components/fortune/FortuneReadingsBlock";
import { DeepAskButton } from "@/components/fortune/DeepAskButton";
import { FortuneScopeNav } from "./_FortuneScopeNav";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import {
  fetchTodayFortune,
  NoDefaultProfileError,
} from "@/lib/fortune/fetch-today";

/**
 * /fortune/[date] — 参考"轻运阁"运势详情：
 *   ← 运势详情 / 头像+昵称+日周月切换 / 7 天 strip / 大字分数 / 7 维垂直柱 /
 *   narrative / 8 lucky / 顶级深入追问 / 轻运解读 + 7 块（每块独立追问）
 */
export const dynamic = "force-dynamic";

export default async function FortuneDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect("/");
  }

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e: unknown) {
    if (e instanceof UnauthenticatedError) return <LoginGate />;
    throw e;
  }

  const profileList = await listProfiles(userId);
  const def = profileList.find((p) => p.is_default);
  if (!def) redirect("/onboarding");

  let fortune;
  try {
    fortune = fetchTodayFortune({ userId, date });
  } catch (e) {
    if (e instanceof NoDefaultProfileError) redirect("/onboarding");
    throw e;
  }

  return (
    <>
      <AppHeader
        title="运势详情"
        left={
          <Link
            href="/"
            className="text-[20px] text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
            aria-label="返回首页"
          >
            ←
          </Link>
        }
      />
      <div className="relative flex flex-1 flex-col gap-4 p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[8%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[16%]" />
        </div>

        <ProfileRow nickname={def.nickname} avatarUrl={def.avatar_url} />

        <FortuneScopeNav date={date} />

        <GlassCard className="space-y-4 p-5" data-testid="fortune-detail-summary">
          <div className="text-center">
            <p className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-fade)]">
              轻 运 分 数{" "}
              <span className="num-mono ml-1 text-[22px] font-semibold text-[var(--color-ink-plum)]">
                {fortune.overall}
              </span>
              <span className="ml-0.5 text-[12px] text-[var(--color-ink-mist)]">分</span>
            </p>
          </div>

          <DimensionBars7Vertical scores={fortune.scores} barHeight={64} barWidthClass="w-3" />

          {fortune.oneLiner && (
            <p className="px-1 text-center font-[family-name:var(--font-serif)] text-[13.5px] leading-relaxed tracking-ritual text-[var(--color-ink-plum)]">
              {fortune.oneLiner}
            </p>
          )}
        </GlassCard>

        <GlassCard className="p-5" data-testid="fortune-detail-attrs">
          <AttributesGrid8 attrs={fortune.attributes} />
        </GlassCard>

        <DeepAskButton
          prefill={`针对今日（${date}）的整体运势深入聊聊：`}
          label="深 入 追 问 →"
        />

        <FortuneReadingsBlock
          date={date}
          scores={fortune.scores}
          reading={fortune.reading}
        />
      </div>
    </>
  );
}

function ProfileRow({
  nickname,
  avatarUrl,
}: {
  nickname: string;
  avatarUrl: string | null;
}) {
  const initial = (nickname || "我").slice(0, 1);
  return (
    <div className="flex items-center gap-3 px-1" data-testid="fortune-detail-profile-row">
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent-lavender)]/30 font-[family-name:var(--font-serif)] text-[14px] text-[var(--color-ink-plum)]">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={nickname} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <span className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[var(--color-ink-plum)]">
        {nickname || "未填写昵称"}
      </span>
    </div>
  );
}
