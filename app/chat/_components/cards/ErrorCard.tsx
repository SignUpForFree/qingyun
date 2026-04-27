"use client";
import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";

export type ErrorCode =
  | "ai_timeout"
  | "ai_rate_limit"
  | "user_rate_limit"
  | "content_safety"
  | "network"
  | "unknown";

export interface ErrorCardProps {
  message: string;
  code?: ErrorCode;
  retryable?: boolean;
  onRetry?: () => void;
  className?: string;
}

const CODE_HINT: Record<ErrorCode, string> = {
  ai_timeout: "AI 演算超时",
  ai_rate_limit: "AI 服务限流",
  user_rate_limit: "用量已达上限",
  content_safety: "话题敏感",
  network: "连接中断",
  unknown: "未知错误",
};

/**
 * 统一错误展示卡（M2.9，spec §4.9）
 *
 * - 错误统一消息 + 可选错误码 hint
 * - retryable=true && onRetry 提供 → 显示重试按钮
 * - 不可重试时（限流 / 内容安全）只展示文案
 */
export function ErrorCard({
  message,
  code,
  retryable,
  onRetry,
  className,
}: ErrorCardProps) {
  const showRetry = retryable === true && Boolean(onRetry);

  return (
    <GlassCard className={cn("p-4", className)}>
      <div role="alert" aria-live="polite" className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--color-wuxing-fire)]/30 px-2 py-0.5 text-[10px] tracking-ritual2 text-[var(--color-ink-plum)]">
            {code ? CODE_HINT[code] : "提示"}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-ink-plum)]">{message}</p>
        {showRetry && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/30 px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)] hover:bg-[var(--color-accent-lavender)]/20"
            >
              重试
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
