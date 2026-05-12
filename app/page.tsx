import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { Button } from "@/components/ui/button";
import { FortuneSummaryCard } from "@/components/fortune/FortuneSummaryCard";
import { LuckyAttrsCard } from "@/components/fortune/LuckyAttrsCard";
import { LauncherStack } from "@/components/fortune/LauncherStack";
import { ProfileSwitcher, type ProfileSwitcherItem } from "@/components/profile/ProfileSwitcher";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import {
  fetchTodayFortune,
  NoDefaultProfileError,
} from "@/lib/fortune/fetch-today";
import { getLunarToday } from "@/lib/util/lunar-date";

/**
 * 首页 — 参考"轻运阁"三卡式：FortuneSummaryCard / LuckyAttrsCard / LauncherStack
 *
 * 4 种页面状态：
 *   1. 未认证 → middleware 已经把它跳到 /api/auth/wechat；这里 try/catch 兜底
 *   2. 未建档 / 默认档丢失 → /onboarding（理论上 M1.7 已建占位档）
 *   3. 默认档为占位（birth_place="未填" / gender="other"）→ "继续完善" CTA
 *   4. 默认档已填 → 三张独立白卡（运势分数 / 幸运物 / 4 入口）
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e: unknown) {
    if (e instanceof UnauthenticatedError) {
      return <LoginGate showButton />;
    }
    throw e;
  }

  const profileList = await listProfiles(userId);
  const def = profileList.find((p) => p.is_default);
  if (!def) redirect("/onboarding");

  const isPlaceholder = def.birth_place === "未填" || def.gender === "other";
  const { headerText } = getLunarToday();

  return (
    <>
      <AppHeader
        left={
          <HomeProfileChip
            nickname={def.nickname}
            gender={def.gender}
            avatarUrl={def.avatar_url}
          />
        }
        title={
          <span
            className="font-[family-name:var(--font-serif)] text-[13px] font-bold tracking-ritual text-[var(--color-ink-plum)]"
            data-testid="home-lunar-date"
          >
            {headerText}
          </span>
        }
      />
      <div className="relative flex flex-1 flex-col items-center gap-5 p-4 pb-safe-bottom">
        <div className="relative z-10 mt-6 w-full max-w-md space-y-4">
          {profileList.length >= 2 && (
            <div className="flex justify-center">
              <ProfileSwitcher profiles={toSwitcherItems(profileList)} />
            </div>
          )}
          {isPlaceholder ? (
            <CompleteProfileCard nickname={def.nickname} />
          ) : (
            <FortuneSection userId={userId} nickname={def.nickname} />
          )}
        </div>
      </div>
    </>
  );
}

function HomeProfileChip({
  nickname,
  gender,
  avatarUrl,
}: {
  nickname: string;
  gender: "male" | "female" | "other";
  avatarUrl: string | null;
}) {
  const href = "/me/profiles";
  // 优先用用户上传的头像，否则用默认 AI 头像
  const imgSrc = avatarUrl || "/images/ai-avatar.png";
  return (
    <Link
      href={href}
      aria-label="我的"
      className="flex min-w-0 max-w-full items-center gap-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/90 shadow-[0_1px_4px_rgba(160,140,210,0.25)]"
      />
      <span className="truncate font-[family-name:var(--font-serif)] text-[14px] font-bold text-[var(--color-ink-plum)]">
        {nickname || "我"}
      </span>
    </Link>
  );
}

async function FortuneSection({
  userId,
  nickname: _nickname,
}: {
  userId: string;
  nickname: string;
}) {
  let fortune;
  try {
    fortune = fetchTodayFortune({ userId });
  } catch (e) {
    if (e instanceof NoDefaultProfileError) {
      redirect("/onboarding");
    }
    throw e;
  }

  return (
    <>
      <FortuneSummaryCard
        date={fortune.date}
        overall={fortune.overall}
        scores={fortune.scores}
        oneLiner={fortune.oneLiner}
      />
      <LuckyAttrsCard attrs={fortune.attributes} />
      <LauncherStack />
    </>
  );
}

function toSwitcherItems(
  list: Awaited<ReturnType<typeof listProfiles>>,
): ProfileSwitcherItem[] {
  return list.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    is_default: p.is_default,
    birth_date: p.birth_date,
    birth_calendar: p.birth_calendar,
    avatar_url: p.avatar_url,
  }));
}

function CompleteProfileCard({ nickname }: { nickname: string }) {
  return (
    <GlassCard className="space-y-4 p-7 text-center">
      <h1 className="font-[family-name:var(--font-serif)] text-[22px] tracking-ritual2 text-[var(--color-ink-plum)]">
        {nickname || "你好"} <Sparkle size={12} />
      </h1>
      <p className="text-sm text-[var(--color-ink-mist)]">
        档案还差一点，把生辰补全才能开始算命
      </p>
      <Divider />
      <p className="text-xs leading-relaxed text-[var(--color-ink-fade)]">
        支持公历 / 农历，按真太阳时排盘。
        <br />
        档案只你自己可见。
      </p>
      <Link href="/onboarding" className="block">
        <Button className="h-12 w-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-white shadow-pill hover:opacity-90">
          继续完善信息
        </Button>
      </Link>
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className="mt-2 text-[11px] text-[var(--color-ink-fade)] underline decoration-dotted underline-offset-4 hover:text-[var(--color-ink-mist)]"
        >
          退出登录
        </button>
      </form>
    </GlassCard>
  );
}
