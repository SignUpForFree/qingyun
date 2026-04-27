import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * 轻运 AI logo（design prompts §1 home header 第 104 行）
 *
 * 圆环描边 + 中心 ✦，淡紫 #C9A1D9，零外部资源（纯 SVG）。
 */
export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      aria-label="轻运"
      role="img"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("text-[var(--color-accent-lavender)]", className)}
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.9"
      />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontSize="16"
        fill="currentColor"
        opacity="0.85"
        fontFamily="serif"
      >
        ✦
      </text>
    </svg>
  );
}
