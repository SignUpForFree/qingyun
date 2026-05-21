"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface SlipImageRitualOverlayProps {
  open: boolean;
  imageUrl: string;
  slipNumber: number;
  level: string;
  title: string;
  poemLines: ReadonlyArray<string>;
  category?: string;
  onClose: () => void;
}

/**
 * 签面全屏预览（雾紫新中式，与分享图主色一致）
 */
export function SlipImageRitualOverlay({
  open,
  imageUrl,
  slipNumber,
  level,
  title,
  poemLines,
  category,
  onClose,
}: SlipImageRitualOverlayProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`第 ${slipNumber} 签全屏查看`}
      data-testid="slip-image-ritual-overlay"
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center px-4 py-6",
        "backdrop-blur-md",
        "bg-gradient-to-b from-[#4a3d5c]/55 via-[#6b5a7a]/50 to-[#8b5d8b]/45",
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-3xl p-4",
          "border border-[var(--color-accent-lavender)]/50",
          "bg-gradient-to-b from-[#FFFBFE] to-[#F0E6F8]",
          "shadow-[var(--shadow-float)]",
        )}
      >
        <header className="mb-3 text-center">
          <p className="font-[family-name:var(--font-calligraphy),var(--font-serif)] text-[22px] tracking-ritual2 text-[var(--color-accent-plum)]">
            第 {slipNumber} 签 · {level}
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-calligraphy),var(--font-serif)] text-[17px] tracking-ritual text-[var(--color-ink-plum)]">
            《{title}》
          </p>
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`第 ${slipNumber} 签全图`}
          className="mx-auto block max-h-[62vh] w-full rounded-2xl object-contain ring-1 ring-[var(--color-accent-lavender)]/25"
          data-testid="ritual-overlay-img"
        />

        <div className="mt-3 space-y-1">
          {poemLines.slice(0, 4).map((line, i) => (
            <p
              key={i}
              className="text-center font-[family-name:var(--font-serif)] text-[13px] tracking-ritual text-[var(--color-ink-plum)]"
            >
              {line}
            </p>
          ))}
        </div>

        {category && (
          <p className="mt-2 text-center text-[11px] tracking-ritual2 text-[var(--color-ink-fade)]">
            关 于 · {category}
          </p>
        )}

        <div
          aria-hidden
          data-testid="ritual-seal"
          className={cn(
            "absolute bottom-3 left-3 flex h-14 w-12 flex-col items-center justify-center rounded-full",
            "border-2 border-[var(--color-ritual-seal)]/45 bg-[var(--color-accent-lavender)]/10",
            "text-[var(--color-ritual-seal-deep)]",
          )}
          style={{ fontFamily: "var(--font-serif)", lineHeight: 1 }}
        >
          <span className="text-[12px] leading-none">福</span>
          <span className="text-[12px] leading-none">小</span>
          <span className="text-[12px] leading-none">运</span>
        </div>

        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className={cn(
            "absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full",
            "border border-[var(--color-accent-lavender)]/60 bg-white/90 text-[15px] text-[var(--color-ink-plum)]",
            "shadow hover:bg-[var(--color-accent-lavender)]/15",
          )}
        >
          ✕
        </button>
      </div>

      <p className="mt-4 text-center text-[11px] tracking-ritual2 text-white/75">
        点击空白处或按 ESC 关闭
      </p>
    </div>
  );
}
