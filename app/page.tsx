import Link from "next/link";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, WatercolorDot, Divider } from "@/components/su";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/profile/current";

/**
 * 首页（spec §1 — P1 占位版）
 *
 * - 未登录 / 无档案 → 引导建档
 * - 已建档 → 简短问候 + "进入对话" CTA
 *
 * P2 D5/D6 会替换为 DailyFortuneCard：大圆环总分 + 7 维度条 + 6 幸运属性
 */
export const dynamic = "force-dynamic"; // 依赖 cookies + supabase user, 不可静态

export default async function HomePage() {
  const profile = await safeGetProfile();

  return (
    <>
      <AppHeader title="轻运 AI" />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[14%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
          <WatercolorDot color="blue" size={140} className="absolute bottom-[18%] left-[35%]" />
        </div>

        <GlassCard className="relative z-10 w-full max-w-md space-y-4 p-7">
          {profile ? (
            <ProfileGreeting nickname={profile.nickname ?? "你"} />
          ) : (
            <OnboardingPrompt />
          )}
        </GlassCard>
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

function ProfileGreeting({ nickname }: { nickname: string }) {
  const greeting = pickGreeting();
  return (
    <>
      <h1 className="text-[22px] tracking-ritual2 text-[var(--color-ink-plum)]">
        {greeting}，{nickname} <Sparkle size={12} />
      </h1>
      <p className="text-sm text-[var(--color-ink-fade)]">
        今天想问点什么？或者只是聊聊
      </p>
      <Divider />
      <Link href="/chat" className="block">
        <Button className="h-12 w-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-white shadow-pill hover:opacity-90">
          进入对话
        </Button>
      </Link>
      <p className="text-xs leading-relaxed text-[var(--color-ink-fade)]">
        每日运势卡 · P2 第 4 周接入
      </p>
    </>
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

/**
 * .env.local 缺失或 Supabase 未接入时退化为 null（不让首页崩）
 */
async function safeGetProfile() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    return await getCurrentProfile();
  } catch (e) {
    console.error("getCurrentProfile 失败（首页降级为未建档态）", e);
    return null;
  }
}
