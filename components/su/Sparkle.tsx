import { cn } from "@/lib/utils";

interface SparkleProps {
  size?: number;
  className?: string;
  variant?: "diamond" | "asterisk";
}

export function Sparkle({ size = 12, className, variant = "diamond" }: SparkleProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block select-none opacity-70",
        "text-[var(--color-accent-lavender)]",
        className,
      )}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      {variant === "diamond" ? "✦" : "✧"}
    </span>
  );
}
