"use client";

import * as React from "react";
import { GlassCard, Sparkle } from "@/components/su";
import { PhoneLoginForm } from "@/components/auth/PhoneLoginForm";

interface LoginGateProps {
  /** 显示品牌入口卡片（首页用），默认 false 时直接展开登录表单 */
  showButton?: boolean;
}

/**
 * 未登录占位 — 服务端 requireUserId 抛 UnauthenticatedError 时由 page 渲染
 *
 * 行为：
 *   - showButton=true（首页）：品牌卡片 + 登录按钮 → 点击展开表单
 *   - showButton=false（其他页）：直接展开登录表单
 *
 * 统一走内嵌 PhoneLoginForm，不再用事件总线（避免 hydration 时序竞争）
 */
export function LoginGate({ showButton = false }: LoginGateProps) {
  const [showForm, setShowForm] = React.useState(!showButton);

  // showButton 模式：先显示入口卡片，点击后展开登录表单
  if (!showForm) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <GlassCard className="space-y-5 p-7 text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-[22px] font-bold tracking-ritual2 text-[var(--color-ink-plum)]">
            轻运阁 <Sparkle size={12} />
          </h1>
          <p className="text-sm text-[var(--color-ink-mist)]">
            AI 占卜 · 每日运势 · 命理陪伴
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-12 w-full rounded-lg bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] font-bold tracking-ritual text-white shadow-pill hover:opacity-90"
          >
            登 录
          </button>
          <p className="text-[10px] leading-relaxed text-[var(--color-ink-fade)]">
            手机号登录 · 仅用于账号识别
          </p>
        </GlassCard>
      </div>
    );
  }

  // 展开登录表单
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <PhoneLoginForm
        onSuccess={({ isNew }) => {
          if (isNew) {
            window.location.href = "/onboarding";
          } else {
            window.location.reload();
          }
        }}
      />
    </div>
  );
}
