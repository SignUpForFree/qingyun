import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { GlassCard } from "@/components/su";
import { Button } from "@/components/ui/button";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { phoneBind } from "@/lib/db/schema";

/**
 * /me/settings — 杂项设置（参考"我的"页瘦身后的容器）
 *
 * 含手机绑定 / 隐私政策 / 用户协议 / 退出登录。
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e: unknown) {
    if (e instanceof UnauthenticatedError) {
      return <LoginGate />;
    }
    throw e;
  }

  const phone = await safeGetPhone(userId);

  return (
    <>
      <AppHeader
        title="设置"
        left={
          <Link
            href="/me"
            className="text-[20px] text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
            aria-label="返回我的"
          >
            ←
          </Link>
        }
      />
      <div className="flex flex-1 flex-col gap-3 p-4 pb-24">
        <PhoneRow phone={phone} />
        <NavList />
        <LogoutBlock />
      </div>
    </>
  );
}

function PhoneRow({ phone }: { phone: string | null }) {
  const masked = phone ? maskPhone(phone) : null;
  return (
    <Link
      href="/me/phone"
      className="block transition active:scale-[0.99]"
      data-testid="settings-phone-row"
    >
      <GlassCard className="flex h-12 items-center gap-3 px-4">
        <span className="flex-1 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[var(--color-ink-plum)]">
          手机号
        </span>
        {masked ? (
          <span className="text-[12px] text-[var(--color-ink-mist)]">{masked}</span>
        ) : (
          <span className="text-[12px] text-[var(--color-ink-fade)]">未绑定</span>
        )}
        <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)]" />
      </GlassCard>
    </Link>
  );
}

interface NavItem {
  label: string;
  href: string;
}

const NAV: ReadonlyArray<NavItem> = [
  { label: "隐私政策", href: "/legal/privacy" },
  { label: "用户协议", href: "/legal/terms" },
];

function NavList() {
  return (
    <GlassCard className="overflow-hidden p-0" data-testid="settings-nav-list">
      {NAV.map((item, idx) => (
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

function LogoutBlock() {
  return (
    <form action="/api/auth/logout" method="POST" className="mt-2">
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
    console.error("/me/settings phoneBind lookup failed", e);
    return null;
  }
}

/**
 * "+8613812345678" → "+86 138****5678"
 */
function maskPhone(e164: string): string {
  if (e164.length < 7) return "***";
  const tail = e164.slice(-4);
  const match = e164.match(/^(\+\d{1,3})(\d+)$/);
  if (!match) return `***${tail}`;
  const cc = match[1];
  const body = match[2];
  if (body.length <= 4) return `${cc} ****`;
  const head = body.slice(0, body.length - 8 > 0 ? 3 : Math.max(body.length - 4, 0));
  return `${cc} ${head}****${tail}`;
}
