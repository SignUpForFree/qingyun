"use client";

import * as React from "react";
import { GlassCard, Sparkle } from "@/components/su";
import { Button } from "@/components/ui/button";
import { openLoginModal } from "@/lib/auth/login-bus";

/**
 * 未登录占位 — 服务端 requireUserId 抛 UnauthenticatedError 时由 page 渲染
 *
 * 行为：mount 时自动 openLoginModal()；提供「登 录」按钮兜底再弹一次
 */
export function LoginGate() {
  React.useEffect(() => {
    openLoginModal();
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-sm space-y-4 p-6 text-center">
        <h2 className="font-[family-name:var(--font-serif)] text-[16px] tracking-ritual2 text-[var(--color-ink-plum)]">
          请先登录 <Sparkle size={10} variant="asterisk" />
        </h2>
        <p className="text-xs text-[var(--color-ink-fade)]">
          手机号 + 6 位验证码登录后即可使用
        </p>
        <Button
          type="button"
          onClick={() => openLoginModal()}
          className="h-11 w-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] text-white"
        >
          登 录
        </Button>
      </GlassCard>
    </div>
  );
}
