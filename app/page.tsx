import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, WatercolorDot, Divider } from "@/components/su";
import { Button } from "@/components/ui/button";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import type { Profile } from "@/lib/db/schema";

/**
 * 首页（V2.0 占位 — M1.12）
 *
 * V1.0 的 DailyFortuneCard / HomeQuickEntries 依赖已被 M1.1 wipe 掉的 schema 列
 * (baziCharts / fortunes / birth_province / calendar_type 等)，运行会崩。这里
 * 用最小占位替代，保证 OAuth → onboarding → 首页 端到端流程可走通。
 *
 * M2/M3/M4 会在此基础上重建：
 *   - M2: 真实今日运势卡片
 *   - M3: 5 大功能入口（运势/抽签/八字/梅花/解梦）
 *   - M4: 多档案切换头
 *
 * 三种页面状态：
 *   1. 未认证 → middleware 已经把它跳到 /api/auth/wechat；这里 try/catch 兜底再跳一次
 *   2. 未建档 / 默认档丢失 → /onboarding（理论上 M1.7 已经建了占位档，所以是兜底）
 *   3. 默认档为占位（birth_place="未填" / gender="other"）→ 显示 "继续完善" CTA
 *   4. 默认档已填 → 显示问候卡 + 5 个 disabled 功能占位
 */
export const dynamic = "force-dynamic";

const FEATURES: ReadonlyArray<{ key: string; label: string; emoji: string }> = [
  { key: "fortune", label: "运势", emoji: "运" },
  { key: "qianwen", label: "抽签", emoji: "签" },
  { key: "bazi", label: "八字", emoji: "八" },
  { key: "meihua", label: "梅花", emoji: "梅" },
  { key: "dream", label: "解梦", emoji: "梦" },
];

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

  const profiles = await listProfiles(userId);
  const def = profiles.find((p) => p.is_default);

  // 理论上 M1.7 已建占位默认档，这里是 defense-in-depth
  if (!def) redirect("/onboarding");

  const isPlaceholder =
    def.birth_place === "未填" || def.gender === "other";

  return (
    <>
      <AppHeader title="轻运 AI" />
      <div className="relative flex flex-1 flex-col items-center gap-5 overflow-hidden p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[14%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
          <WatercolorDot color="blue" size={140} className="absolute bottom-[18%] left-[35%]" />
        </div>

        <div className="relative z-10 mt-8 w-full max-w-md space-y-4">
          {isPlaceholder ? (
            <CompleteProfileCard nickname={def.nickname} />
          ) : (
            <GreetingCard profile={def} />
          )}
          <FeaturePlaceholders />
        </div>
      </div>
    </>
  );
}

function GreetingCard({ profile }: { profile: Profile }) {
  return (
    <GlassCard className="space-y-3 p-6 text-center">
      <h1 className="font-[family-name:var(--font-serif)] text-[22px] tracking-ritual2 text-[var(--color-ink-plum)]">
        {profile.nickname || "朋友"} <Sparkle size={12} />
      </h1>
      <Divider />
      <p className="text-xs leading-relaxed text-[var(--color-ink-fade)]">
        生辰 · {profile.birth_date} {profile.birth_time}
        <br />
        {profile.birth_calendar === "lunar" ? "农历" : "公历"} · {profile.birth_place}
      </p>
    </GlassCard>
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

function FeaturePlaceholders() {
  return (
    <GlassCard className="space-y-3 p-5">
      <p className="text-center font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
        功能入口 <Sparkle size={10} />
      </p>
      <div className="grid grid-cols-5 gap-2">
        {FEATURES.map((f) => (
          <div
            key={f.key}
            className="flex cursor-not-allowed flex-col items-center gap-1.5 rounded-[10px] border border-[var(--color-accent-lavender)]/30 bg-white/40 p-3 opacity-60"
            title="敬请期待"
          >
            <span className="font-[family-name:var(--font-serif)] text-[15px] text-[var(--color-ink-plum)]">
              {f.emoji}
            </span>
            <span className="text-[10px] text-[var(--color-ink-mist)]">
              {f.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-[var(--color-ink-fade)]">
        敬请期待
      </p>
    </GlassCard>
  );
}
