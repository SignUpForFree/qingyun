import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle } from "@/components/su";
import { Button } from "@/components/ui/button";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import { getDb } from "@/lib/db/client";
import { phoneBind, conversations, users } from "@/lib/db/schema";
import type { Profile } from "@/lib/db/schema";
import { getLunarToday } from "@/lib/util/lunar-date";

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

  const [phone, stats] = await Promise.all([
    safeGetPhone(userId),
    safeGetStats(userId),
  ]);

  return (
    <>
      <AppHeader title="我 的" />
      <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
        <ProfileHero profile={def} />
        <QuickStats {...stats} />
        <PhoneBindRow phoneE164={phone} />
        <MenuList />
        <LogoutBlock />
        <p className="px-1 pt-2 text-center text-[10px] tracking-ritual text-[var(--color-ink-fade)]">
          轻运 AI · 诚 心 者 得 吉 兆
        </p>
      </div>
    </>
  );
}

/**
 * Profile Hero（design §9 第 550-558）：
 * - 渐变 lavender→pink 软底淡入页面背景
 * - 72px avatar（首字 / 头像图）+ 22px nickname + 农历副标 + gender pill
 */
function ProfileHero({ profile }: { profile: Profile }) {
  const genderLabel =
    profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "其他";
  const calendarLabel = profile.birth_calendar === "lunar" ? "农历" : "公历";
  const isPlaceholder =
    profile.birth_place === "未填" || profile.gender === "other";
  const initial = (profile.nickname || "我").slice(0, 1);

  // 农历副标（如"丙午年 · 三月初七 生"）
  let lunarSub: string | null = null;
  try {
    const d = new Date(profile.birth_date + "T12:00:00+08:00");
    if (!Number.isNaN(d.getTime())) {
      const lt = getLunarToday(d);
      lunarSub = `${lt.ganzhiYear} · ${lt.lunarMonthDay} 生`;
    }
  } catch {
    /* 兜底：缺生辰日期解析失败时不显示副标 */
  }

  return (
    <div
      className="relative overflow-hidden rounded-[18px]"
      data-testid="me-profile-hero"
    >
      {/* 渐变软底 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(240,184,200,0.35) 0%, rgba(201,161,217,0.25) 50%, rgba(255,255,255,0.05) 100%)",
        }}
      />
      <div className="relative flex items-center gap-4 p-5">
        {/* avatar 72px */}
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/60 shadow-[0_4px_12px_rgba(200,170,220,0.25)]">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.nickname}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-[family-name:var(--font-serif)] text-[28px] text-[var(--color-ink-plum)]">
              {initial}
            </span>
          )}
        </div>

        <div className="flex-1 space-y-1">
          <h2 className="font-[family-name:var(--font-serif)] text-[18px] tracking-ritual text-[var(--color-ink-plum)]">
            {profile.nickname || "(未填昵称)"}
            <Sparkle size={10} className="ml-1.5" />
          </h2>
          {lunarSub && (
            <p className="text-[11px] text-[var(--color-ink-fade)]">{lunarSub}</p>
          )}
          <span className="inline-flex items-center rounded-full bg-white/60 px-2.5 py-0.5 text-[10px] tracking-ritual2 text-[var(--color-ink-mist)]">
            {genderLabel} · {calendarLabel}
          </span>
        </div>
      </div>
      {isPlaceholder && (
        <p className="relative px-5 pb-3 text-[11px] text-[var(--color-accent-lavender)]">
          档案还是占位数据，去 编辑档案 把它填好
        </p>
      )}
    </div>
  );
}

/**
 * 3 Quick Stats（design §9 第 559）— 总会话 / 抽签数 / 使用天数
 */
function QuickStats({
  conversations: convs,
  daysUsed,
}: {
  conversations: number;
  daysUsed: number;
}) {
  const items = [
    { num: convs, label: "对 话" },
    // 抽签 stats 暂用 conversations 兜底（M3 接 slips 计数后切换）
    { num: convs > 0 ? Math.max(1, Math.floor(convs / 3)) : 0, label: "占 卜" },
    { num: daysUsed, label: "陪 伴 天 数" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="me-quick-stats">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-[12px] border border-[var(--color-accent-lavender)]/20 bg-white/70 px-2 py-2.5 text-center backdrop-blur-sm"
        >
          <p className="num-mono font-[family-name:var(--font-serif)] text-[20px] text-[var(--color-ink-plum)]">
            {it.num}
          </p>
          <p className="text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
            {it.label}
          </p>
        </div>
      ))}
    </div>
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
              <span className="flex-1 font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)]" />
            </Link>
          )}
          {idx < MENU.length - 1 && (
            // ✦ 装饰分割线（design §9 第 564 行）
            <div className="flex items-center gap-2 px-4">
              <span className="h-px flex-1 bg-[var(--color-accent-lavender)]/25" />
              <Sparkle size={8} variant="diamond" />
              <span className="h-px flex-1 bg-[var(--color-accent-lavender)]/25" />
            </div>
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

async function safeGetStats(userId: string): Promise<{
  conversations: number;
  daysUsed: number;
}> {
  try {
    const db = getDb();
    const [convCount, userRow] = await Promise.all([
      db
        .select({ n: count() })
        .from(conversations)
        .where(eq(conversations.user_id, userId)),
      db
        .select({ created_at: users.created_at })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);
    const convs = convCount[0]?.n ?? 0;
    const createdAt = userRow[0]?.created_at;
    const daysUsed = createdAt
      ? Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(createdAt).getTime()) / 86_400_000,
          ) + 1,
        )
      : 1;
    return { conversations: convs, daysUsed };
  } catch (e: unknown) {
    console.error("/me stats lookup failed", e);
    return { conversations: 0, daysUsed: 1 };
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
