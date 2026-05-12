import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { Sparkle, WatercolorDot } from "@/components/su";
import { PhoneBindCard } from "@/components/profile/PhoneBindCard";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { phoneBind } from "@/lib/db/schema";

/**
 * /me/phone — 手机号绑定 / 换绑（spec §3.5 / plan §M1.10）
 *
 * 显示当前已绑号码（脱敏）+ PhoneBindCard 表单。
 * dev 模式 OTP 走 console.info，M5 接入 SMS 网关后切真实下发。
 */
export const dynamic = "force-dynamic";

export default async function MePhonePage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return <LoginGate />;
    throw e;
  }

  const currentPhone = await loadMaskedPhone(userId);

  return (
    <>
      <AppHeader
        left={
          <Link
            href="/me"
            aria-label="返回"
            className="flex h-8 w-8 items-center justify-center text-[var(--color-ink-mist)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        }
        title={
          <span className="flex items-center gap-1.5 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-plum)]">
            手 机 绑 定 <Sparkle size={9} variant="asterisk" />
          </span>
        }
      />
      <div className="relative flex flex-1 flex-col overflow-hidden p-4 pb-safe-bottom">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[10%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
          <WatercolorDot color="blue" size={140} className="absolute bottom-[20%] left-[35%]" />
        </div>
        <div className="relative z-10 mx-auto mt-4 w-full max-w-md">
          <PhoneBindCard currentPhone={currentPhone} />
        </div>
      </div>
    </>
  );
}

/**
 * 把 +8613888887777 渲染成 +86 138****7777（中间 4 位脱敏）。
 * 仅展示用，不入 schema。
 */
async function loadMaskedPhone(userId: string): Promise<string | null> {
  try {
    const db = getDb();
    const rows = await db
      .select({ phone: phoneBind.phone_e164 })
      .from(phoneBind)
      .where(eq(phoneBind.user_id, userId))
      .limit(1);
    const phone = rows[0]?.phone;
    if (!phone) return null;
    const m = /^\+86(\d{3})\d{4}(\d{4})$/.exec(phone);
    if (!m) return phone;
    return `+86 ${m[1]}****${m[2]}`;
  } catch {
    return null;
  }
}
