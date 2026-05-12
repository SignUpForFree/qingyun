import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Pencil } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { GlassCard } from "@/components/su";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import type { Profile } from "@/lib/db/schema";

/**
 * /me — 参考"轻运阁"极简：← 我的 / 头像卡（头像+昵称+出生+编辑）/ 档案信息 / 设置
 *
 * 杂项（手机绑定、隐私、协议、退出登录）收到 /me/settings 子页。
 */
export const dynamic = "force-dynamic";

export default async function MePage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e: unknown) {
    if (e instanceof UnauthenticatedError) {
      return <LoginGate />;
    }
    throw e;
  }

  const profiles = await listProfiles(userId);
  const def = profiles.find((p) => p.is_default);
  if (!def) redirect("/onboarding");

  return (
    <>
      <AppHeader
        title="我的"
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
      <div className="flex flex-1 flex-col gap-3 p-4 pb-safe-bottom">
        <ProfileCard profile={def} />
        <MenuList />
      </div>
    </>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const isPlaceholder =
    profile.birth_place === "未填" || profile.gender === "other";
  const birthLine = isPlaceholder
    ? "出生：未填写"
    : `出生：${profile.birth_date}${profile.birth_calendar === "lunar" ? "（农历）" : ""}`;

  return (
    <GlassCard className="relative p-5" data-testid="me-profile-card">
      <Link
        href="/me/edit"
        className="absolute right-4 top-4 inline-flex h-7 items-center gap-1 rounded-full bg-gradient-to-r from-[#F0B8C8]/40 to-[#C9A1D9]/40 px-3 text-[11px] tracking-ritual text-[var(--color-accent-plum)] transition hover:from-[#F0B8C8]/60 hover:to-[#C9A1D9]/60"
        data-testid="me-edit-link"
      >
        <Pencil className="h-3 w-3" />
        编辑
      </Link>
      <div className="flex items-center gap-4">
        <AvatarPicker
          currentUrl={profile.avatar_url}
          nickname={profile.nickname}
          profileId={profile.id}
          size={56}
        />
        <div className="flex-1 space-y-1.5">
          <h2 className="font-[family-name:var(--font-serif)] text-[16px] tracking-ritual text-[var(--color-ink-plum)]">
            {profile.nickname || "未填写昵称"}
          </h2>
          <p className="text-[11.5px] text-[var(--color-ink-fade)]">{birthLine}</p>
        </div>
      </div>
    </GlassCard>
  );
}

interface MenuItem {
  label: string;
  href: string;
}

const MENU: ReadonlyArray<MenuItem> = [
  { label: "档案信息", href: "/me/profiles" },
  { label: "设置", href: "/me/settings" },
];

function MenuList() {
  return (
    <GlassCard className="overflow-hidden p-0" data-testid="me-menu-list">
      {MENU.map((item, idx) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex h-12 items-center gap-3 px-4 transition-colors hover:bg-[var(--color-accent-lavender)]/10 ${
            idx > 0 ? "border-t border-[var(--color-accent-lavender)]/20" : ""
          }`}
        >
          <span className="flex-1 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[var(--color-ink-plum)]">
            {item.label}
          </span>
          <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)]" />
        </Link>
      ))}
    </GlassCard>
  );
}
