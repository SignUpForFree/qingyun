"use client";

import { cn } from "@/lib/utils";
import {
  SLIP_MIST_BORDER,
  SLIP_MIST_GRADIENT,
  SLIP_MIST_HEADER,
  SLIP_MIST_SHADOW,
} from "./slip-mist-styles";

/** 动效用空白灵签条（雾紫 · 无签诗/无真实签图） */
export function SlipPlaceholderShell({
  className,
  size = "md",
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "mx-auto aspect-[3/5] w-full max-w-[280px] min-h-[320px]"
      : size === "md"
        ? "mx-auto aspect-[3/5] w-full max-w-[220px] min-h-[200px]"
        : size === "sm"
          ? "mx-auto aspect-[3/5] w-[52%] max-w-[200px] min-h-[160px]"
          : "mx-auto aspect-[3/5] w-full min-h-[96px]";

  const sealSize =
    size === "lg" ? "3rem" : size === "md" ? "2rem" : size === "sm" ? "1.5rem" : "1.1rem";

  return (
    <div
      className={cn("relative overflow-hidden rounded-md", dim, className)}
      style={{
        background: SLIP_MIST_GRADIENT,
        border: SLIP_MIST_BORDER,
        boxShadow: SLIP_MIST_SHADOW,
      }}
      data-testid="slip-placeholder-shell"
    >
      <div
        className={cn(
          "absolute inset-x-3 rounded-sm",
          size === "xs" ? "top-2 h-3" : "top-3 h-5",
        )}
        style={{ background: SLIP_MIST_HEADER }}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-4 rounded-sm opacity-35",
          size === "xs" ? "top-7 bottom-3" : "top-12 bottom-10",
        )}
        style={{
          background:
            "repeating-linear-gradient(180deg, transparent, transparent 10px, rgba(201,161,217,0.16) 10px, rgba(201,161,217,0.16) 11px)",
        }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-serif)] text-[var(--color-accent-plum)]/30"
        style={{
          writingMode: "vertical-rl",
          fontSize: sealSize,
        }}
      >
        签
      </span>
    </div>
  );
}
