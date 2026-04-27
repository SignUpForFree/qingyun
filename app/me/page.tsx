import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { Button } from "@/components/ui/button";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import { getDb } from "@/lib/db/client";
import { phoneBind } from "@/lib/db/schema";
import type { Profile } from "@/lib/db/schema";

/**
 * /me 页 — 档案信息 + 入口列表（V2.0 占位 — M1.12）
 *
 * V1.0 用 V1.0 schema 列（calendar_type / birth_province / birth_city / birth_district），
 * 这些列在 V2.0 wipe (M1.1) 已删除。这里换成 V2.0 schema 的最小占位。
 *
 * V2.0 字段映射：
 *   calendar_type        → birth_calendar
 *   birth_province/...   → birth_place（单字段）
 *   gender male/female   → male/female/other
 *
 * 入口列表：
 *   - 编辑档案 → /onboarding（M4 之前先用整体重填覆盖默认档）
 *   - 多档案管理 → 占位 disabled（M4 实装 /me/profiles）
 *   - 隐私政策 → /legal/privacy
 *   - 用户协议 → /legal/terms
 *   - 退出登录 → POST /api/auth/logout
 */
export const dynamic = "force-dynamic";

export default async function MePage() {
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

  // M1.7 应保证默认档存在；这里兜底走 onboarding
  if (!def) redirect("/onboarding");

  const phone = await safeGetPhone(userId);

  return (
    <>
      <AppHeader title="我的" />
      <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
        <ProfileCard profile={def} />
        <PhoneBindRow phoneE164={phone} />
        <MenuList />
        <LogoutBlock />
        <p className="px-1 pt-2 text-center text-[10px] text-[var(--color-ink-fade)]">
          轻运 AI · V2.0 · 占位页（M2/M3/M4 重建）
        </p>
      </div>
    </>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const genderLabel =
    profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "其他";
  const calendarLabel = profile.birth_calendar === "lunar" ? "农历" : "公历";
  const isPlaceholder =
    profile.birth_place === "未填" || profile.gender === "other";

  return (
    <GlassCard className="space-y-3 p-5">
      <div className="space-y-0.5">
        <h2 className="font-[family-name:var(--font-serif)] text-[18px] tracking-ritual text-[var(--color-ink-plum)]">
          {profile.nickname || "(未填昵称)"}
          <Sparkle size={10} className="ml-1.5" />
        </h2>
        <p className="text-[11px] text-[var(--color-ink-fade)]">
          性别 · {genderLabel}
        </p>
      </div>
      <Divider />
      <Row label="出生日期" value={`${profile.birth_date} · ${calendarLabel}`} />
      <Row label="出生时辰" value={profile.birth_time || "—"} />
      <Row label="出生地" value={profile.birth_place || "—"} />
      {isPlaceholder && (
        <p className="pt-1 text-[11px] text-[var(--color-accent-lavender)]">
          档案还是占位数据，去 编辑档案 把它填好
        </p>
      )}
    </GlassCard>
  );
}

function PhoneBindRow({ phoneE164 }: { phoneE164: string | null }) {
  const masked = phoneE164 ? maskPhone(phoneE164) : null;
  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <span className="flex-1 text-sm text-[var(--color-ink-plum)]">手机号</span>
      {masked ? (
        <span className="text-xs text-[var(--color-ink-mist)]">已绑定 {masked}</span>
      ) : (
        // TODO(M3): 链接到 /me/bind-phone（OTP 流程已在 M1 实装，UI 还没接）
        <span className="text-xs text-[var(--color-ink-fade)]">未绑定</span>
      )}
    </GlassCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-[var(--color-ink-fade)]">{label}</span>
      <span className="text-sm text-[var(--color-ink-plum)]">{value}</span>
    </div>
  );
}

interface MenuItem {
  label: string;
  href: string;
  disabled?: boolean;
  note?: string;
}

const MENU: ReadonlyArray<MenuItem> = [
  { label: "编辑档案", href: "/onboarding" },
  { label: "多档案管理", href: "/me/profiles", disabled: true, note: "M4 实装" },
  { label: "隐私政策", href: "/legal/privacy" },
  { label: "用户协议", href: "/legal/terms" },
];

function MenuList() {
  return (
    <GlassCard className="overflow-hidden p-0">
      {MENU.map((item, idx) => (
        <div key={item.label}>
          {item.disabled ? (
            <DisabledRow label={item.label} note={item.note ?? "敬请期待"} />
          ) : (
            <Link
              href={item.href}
              className="flex h-12 items-center gap-3 px-4 transition-colors hover:bg-[var(--color-accent-lavender)]/10"
            >
              <span className="flex-1 font-[family-name:var(--font-serif)] text-sm text-[var(--color-ink-plum)]">
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)]" />
            </Link>
          )}
          {idx < MENU.length - 1 && (
            <div className="ml-4 h-[0.5px] bg-[var(--color-accent-lavender)]/30" />
          )}
        </div>
      ))}
    </GlassCard>
  );
}

function DisabledRow({ label, note }: { label: string; note: string }) {
  return (
    <div
      className="flex h-12 cursor-not-allowed items-center gap-3 px-4 opacity-50"
      title={note}
    >
      <span className="flex-1 font-[family-name:var(--font-serif)] text-sm text-[var(--color-ink-mist)]">
        {label}
      </span>
      <span className="text-[10px] text-[var(--color-ink-fade)]">{note}</span>
    </div>
  );
}

function LogoutBlock() {
  // M1.12: 用 form POST /api/auth/logout，避免在 RSC 里搞 client component
  return (
    <form action="/api/auth/logout" method="POST">
      <Button
        type="submit"
        variant="outline"
        className="h-11 w-full text-sm text-[var(--color-ink-mist)]"
      >
        退出登录
      </Button>
    </form>
  );
}

async function safeGetPhone(userId: string): Promise<string | null> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(phoneBind)
      .where(eq(phoneBind.user_id, userId))
      .limit(1);
    return rows[0]?.phone_e164 ?? null;
  } catch (e: unknown) {
    console.error("/me phoneBind lookup failed", e);
    return null;
  }
}

/**
 * 仅展示后 4 位（spec §3.5 隐私 — 用户列表里也只显 mask）
 *   "+8613812345678" → "+86 138****5678"
 */
function maskPhone(e164: string): string {
  // 兼容多种长度，最少 mask 中间 4 位
  if (e164.length < 7) return "***";
  const tail = e164.slice(-4);
  // 把 +86 / +1 等国家码留出来，中间的全部 *
  const match = e164.match(/^(\+\d{1,3})(\d+)$/);
  if (!match) return `***${tail}`;
  const cc = match[1];
  const body = match[2];
  if (body.length <= 4) return `${cc} ****`;
  const head = body.slice(0, body.length - 8 > 0 ? 3 : Math.max(body.length - 4, 0));
  return `${cc} ${head}****${tail}`;
}
