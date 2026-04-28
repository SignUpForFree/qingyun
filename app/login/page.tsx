import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { Sparkle, WatercolorDot } from "@/components/su";
import { PhoneLoginForm } from "./_components/PhoneLoginForm";
import { LoginRedirectGate } from "./_components/LoginRedirectGate";

/**
 * /login — 浏览器手机号登录页（spec §M5 / mock 阶段）
 *
 * 流程：
 *   - 微信内访问会被 middleware 直接重定向到 /api/auth/wechat（OAuth），不会走到这里
 *   - 浏览器端走手机号 + 6 位 OTP，发码当前 mock（dev console.info / prod 同样）
 *   - 登录成功：isNew → /onboarding；否则 → ?next= 或 /
 *
 * 需要 force-dynamic：依赖请求 cookie / searchParams，不能 SSG。
 */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <>
      <AppHeader
        left={
          <Link
            href="/"
            aria-label="返回"
            className="flex h-8 w-8 items-center justify-center text-[var(--color-ink-mist)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        }
        title={
          <span className="flex items-center gap-1.5 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-plum)]">
            欢 迎 回 来 <Sparkle size={9} variant="asterisk" />
          </span>
        }
      />
      <div className="relative flex flex-1 flex-col overflow-hidden p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[10%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
          <WatercolorDot color="blue" size={140} className="absolute bottom-[20%] left-[35%]" />
        </div>
        <div className="relative z-10 mx-auto mt-4 w-full max-w-md">
          <Suspense fallback={<PhoneLoginForm />}>
            <LoginRedirectGate />
          </Suspense>
        </div>
      </div>
    </>
  );
}
