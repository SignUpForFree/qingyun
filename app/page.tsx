import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, WatercolorDot, Divider } from "@/components/su";
import { Button } from "@/components/ui/button";
import { DailyFortuneCardV2 } from "@/components/fortune/DailyFortuneCardV2";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import {
  fetchTodayFortune,
  NoDefaultProfileError,
} from "@/lib/fortune/fetch-today";

/**
 * 首页 (M4.4, image2)
 *
 * 4 种页面状态：
 *   1. 未认证 → middleware 已经把它跳到 /api/auth/wechat；这里 try/catch 兜底
 *   2. 未建档 / 默认档丢失 → /onboarding（理论上 M1.7 已建占位档）
 *   3. 默认档为占位（birth_place="未填" / gender="other"）→ "继续完善" CTA
 *   4. 默认档已填 → DailyFortuneCardV2 完整运势卡（7 维度 + 8 lucky + 4 launcher）
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e: unknown) {
    if (e instanceof UnauthenticatedError) {
      redirect("/api/auth/wechat");
    }
    throw e;
  }

  const profileList = await listProfiles(userId);
  const def = profileList.find((p) => p.is_default);
  if (!def) redirect("/onboarding");

  const isPlaceholder = def.birth_place === "未填" || def.gender === "other";

  return (
    <>
      <AppHeader title="轻运 AI" />
      <div className="relative flex flex-1 flex-col items-center gap-5 overflow-hidden p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[14%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
          <WatercolorDot color="blue" size={140} className="absolute bottom-[18%] left-[35%]" />
        </div>

        <div className="relative z-10 mt-6 w-full max-w-md space-y-4">
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

async function FortuneSection({
  userId,
  nickname,
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
    <DailyFortuneCardV2
      fortune={{
        date: fortune.date,
        overall: fortune.overall,
        scores: fortune.scores,
        oneLiner: fortune.oneLiner,
        attributes: fortune.attributes,
      }}
      nickname={nickname}
    />
  );
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
    </GlassCard>
  );
}
