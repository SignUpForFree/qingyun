"use client";

import { useSubscription } from "@/components/auth/MembershipGate";
import { cn } from "@/lib/utils";

/**
 * 会员标识小徽章
 *
 * - premium 时显示渐变徽章
 * - free 时不渲染任何内容
 */
export function MemberBadge({ className }: { className?: string }) {
  const sub = useSubscription();

  if (sub.plan !== "premium") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9]",
        "text-[10px] font-medium text-white shadow-pill",
        className,
      )}
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 3l3.057-3L12 5.25 15.943 0 19 3l-1.5 6H6.5L5 3zm3.5 9h5v9h-5v-9z"
        />
      </svg>
      会员
    </span>
  );
}
