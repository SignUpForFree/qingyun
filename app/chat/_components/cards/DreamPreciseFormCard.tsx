"use client";

import * as React from "react";
import { MoonStar } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormCard } from "./FormCard";
import { DREAM_PRECISE_FIELDS } from "./form-fields";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface DreamPreciseFormCardProps {
  /** 引导文案（卡片的 content） */
  introText?: string;
  busy?: boolean;
  onSubmit: (values: Record<string, string>) => void;
  className?: string;
}

/**
 * 解梦精准表单 — 点击触发行打开底部 Sheet 抽屉
 *
 * 需求 §精准解梦："当用户点击精准解读时，弹出抽屉表单"
 * - 卡片展示引导文案 + "填写梦境详情"按钮
 * - 点击按钮 → Sheet 从底部弹出 → 内含 4 字段 FormCard
 * - Sheet 右上角关闭按钮
 */
export function DreamPreciseFormCard({
  introText,
  busy,
  onSubmit,
  className,
}: DreamPreciseFormCardProps) {
  const [open, setOpen] = React.useState(false);

  const handleSubmit = (values: Record<string, string>) => {
    onSubmit(values);
    setOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {introText && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-plum)]">
          {introText}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-[8px] border border-input bg-white px-3 py-2.5 text-sm transition-colors",
          "hover:bg-[var(--color-accent-lavender)]/10 disabled:opacity-50",
          "text-[var(--color-ink-fade)]",
        )}
      >
        <MoonStar className="h-4 w-4 opacity-60" />
        <span className="flex-1 text-left">填写梦境详情（精准解读）</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[16px] border-t border-[var(--color-accent-lavender)]/30 bg-[var(--color-bg-paper)] p-0"
        >
          <SheetHeader className="border-b border-[var(--color-accent-lavender)]/20 pb-3">
            <SheetTitle className="text-center font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-[var(--color-ink-plum)]">
              精准解梦
            </SheetTitle>
            <SheetDescription className="sr-only">
              请填写梦境详细信息
            </SheetDescription>
          </SheetHeader>

          <div className="max-h-[60vh] overflow-y-auto p-4">
            <FormCard
              title=""
              fields={DREAM_PRECISE_FIELDS}
              submitLabel="精准解梦"
              busy={busy}
              onSubmit={handleSubmit}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
