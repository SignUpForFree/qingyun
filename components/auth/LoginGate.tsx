"use client";

import { PhoneLoginForm } from "@/components/auth/PhoneLoginForm";

/**
 * 未登录占位 — 全屏登录（覆盖底栏，避免卡片式居中布局）
 */
export function LoginGate() {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[var(--color-bg-paper)]"
      data-testid="login-gate"
    >
      {/* 氛围背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201, 161, 217, 0.35), transparent 55%),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(240, 184, 200, 0.2), transparent 50%),
            radial-gradient(ellipse 50% 35% at 0% 80%, rgba(164, 184, 232, 0.15), transparent 45%),
            linear-gradient(180deg, #fefdfe 0%, #faf5fb 45%, #f5f0fa 100%)
          `,
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(5.5rem,env(safe-area-inset-top))]">
        <header className="mb-8 shrink-0 text-center">
          <p className="text-[11px] tracking-[0.35em] text-[var(--color-ink-fade)]">FUXIAOYUN</p>
          <h1 className="mt-2 font-[family-name:var(--font-serif)] text-[36px] font-bold leading-tight tracking-ritual text-[var(--color-ink-plum)]">
            福小运
          </h1>
          <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-relaxed text-[var(--color-ink-mist)]">
            AI 占卜与每日运势
            <br />
            用手机号安全登录
          </p>
        </header>

        <PhoneLoginForm
          layout="fullscreen"
          className="w-full shrink-0"
          onSuccess={({ isNew }) => {
            if (isNew) {
              window.location.href = "/onboarding";
            } else {
              window.location.reload();
            }
          }}
        />
      </div>
    </div>
  );
}
