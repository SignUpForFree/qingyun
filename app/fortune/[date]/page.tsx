import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { GlassCard, WatercolorDot, Divider, Sparkle } from "@/components/su";
import { ScoreRing } from "@/components/fortune/ScoreRing";
import { DimensionDetailCards } from "@/components/fortune/DimensionDetailCards";
import { DeepAskButton } from "@/components/fortune/DeepAskButton";
import { AttributesGrid8 } from "@/components/fortune/AttributesGrid8";
import { FortuneScopeNav } from "./_FortuneScopeNav";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import {
  fetchTodayFortune,
  NoDefaultProfileError,
} from "@/lib/fortune/fetch-today";

/**
 * /fortune/[date] (M4.7, image3)
 *
 * 详细运势页：
 *   - 顶部 DayWeekMonthSwitcher + DateRangeStrip（client side）
 *   - 综合 ScoreRing
 *   - 7 维度细节卡 + bar + 60-80 字 reading
 *   - 8 lucky 属性 grid
 *   - 深入追问按钮 → /chat?prefill=
 *
 * RSC 拿数据：复用 fetchTodayFortune（接受 date 参数）。客户端切换 scope/date 时
 * 走 next/link 跳新路径，不 fetch；保持 RSC 简单。
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
    if (e instanceof UnauthenticatedError) redirect("/api/auth/wechat");
    throw e;
  }

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
        title="今日运势"
        left={
          <Link
            href="/"
            className="text-[18px] text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
            aria-label="返回首页"
          >
            ‹
          </Link>
        }
      />
      <div className="relative flex flex-1 flex-col items-center gap-4 overflow-hidden p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[14%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
        </div>

        <div className="relative z-10 mt-2 w-full max-w-md space-y-4">
          <FortuneScopeNav date={date} />

          <GlassCard className="space-y-4 p-6">
            <div className="text-center">
              <p className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
                {date} <Sparkle size={8} />
              </p>
            </div>
            <div className="flex justify-center">
              <ScoreRing score={fortune.overall} size={150} />
            </div>
            {fortune.oneLiner && (
              <p className="px-2 text-center text-[13px] leading-relaxed text-[var(--color-ink-mist)]">
                {fortune.oneLiner}
              </p>
            )}
            <Divider />
            <AttributesGrid8 attrs={fortune.attributes} />
          </GlassCard>

          <DimensionDetailCards scores={fortune.scores} reading={fortune.reading} />

          <DeepAskButton
            prefill={`针对今日（${date}）运势深入聊聊：`}
            label="深入追问 →"
          />
        </div>
      </div>
    </>
  );
}
