import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  total: number;
  className?: string;
}

/**
 * onboarding 顶部进度点 ●●○ — 设计文档 §2 onboarding
 * 已完成/当前用淡紫粉填充，未到的步用空圆 + 雾紫边框。
 */
export function StepIndicator({ current, total, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)} aria-hidden>
      {Array.from({ length: total }).map((_, i) => {
        const reached = i < current;
        return (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full transition-all duration-300",
              reached
                ? "bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] shadow-pill"
                : "border border-[var(--color-ink-ghost)] bg-transparent",
            )}
          />
        );
      })}
    </div>
  );
}
