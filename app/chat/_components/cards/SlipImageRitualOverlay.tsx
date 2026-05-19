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
 * 抽签结果图全屏仪式特化层 (M4.22 / image10)
 *
 * - 木纹背景（CSS gradient + repeating-linear-gradient 自画，不下载图）
 * - 顶部「第 N 签 · 等级」书法字红朱
 * - 中央放 PNG 大图（zoom-fit max 90vh）
 * - 左下角红朱印章方框（"福小运" 落款）
 * - 右下角 ✕ 关闭
 * - ESC + 点击背景关闭
 *
 * 不动 SlipImageCard 的卡片版渲染，只在卡片图片上挂 onClick → onOpen 打开此层。
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-4 py-6 backdrop-blur-md"
      style={{
        background:
          // 木纹基调：暖米黄 + 沿水平细纹
          "linear-gradient(180deg, rgba(64,40,28,0.72) 0%, rgba(48,24,12,0.85) 50%, rgba(64,40,28,0.72) 100%)," +
          "repeating-linear-gradient(0deg, rgba(120,80,50,0.18) 0px, rgba(120,80,50,0.18) 1px, transparent 1px, transparent 5px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border-2 border-[#a87c5e] bg-[#F5EFE6] p-5 shadow-2xl"
      >
        <header className="mb-3 text-center">
          <p className="font-[family-name:var(--font-calligraphy),var(--font-serif)] text-[24px] tracking-ritual2 text-[#7d2f2f]">
            第 {slipNumber} 签 · {level}
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-calligraphy),var(--font-serif)] text-[16px] tracking-ritual text-[#3a2a4a]">
            《{title}》
          </p>
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`第 ${slipNumber} 签全图`}
          className="mx-auto block max-h-[60vh] w-auto rounded-[10px] border border-[#a87c5e]/40"
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
          <p className="mt-2 text-center text-[11px] tracking-ritual2 text-[#7d2f2f]/85">
            关 于 · {category}
          </p>
        )}

        {/* 红朱方框落款印章 */}
        <div
          aria-hidden
          data-testid="ritual-seal"
          className="absolute bottom-3 left-3 flex h-14 w-12 flex-col items-center justify-center rounded-md border-2 border-[#a83333]/65"
          style={{
            color: "rgba(168,51,51,0.78)",
            fontFamily: "var(--font-serif)",
            lineHeight: 1,
          }}
        >
          <span className="text-[12px] leading-none">福</span>
          <span className="text-[12px] leading-none">小</span>
          <span className="text-[12px] leading-none">运</span>
        </div>

        {/* 关闭按钮 */}
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className={cn(
            "absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full",
            "border border-[#a87c5e] bg-[#F5EFE6] text-[15px] text-[#3a2a4a]",
            "shadow hover:bg-[#a87c5e]/15",
          )}
        >
          ✕
        </button>
      </div>

      <p className="mt-4 text-center text-[11px] tracking-ritual2 text-[#F5EFE6]/70">
        点击空白处或按 ESC 关闭
      </p>
    </div>
  );
}
