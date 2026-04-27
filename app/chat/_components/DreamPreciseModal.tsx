"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface DreamPreciseFormData {
  core: string;
  emotion: string;
  reality: string;
  special: string;
}

export interface DreamPreciseModalProps {
  open: boolean;
  onSubmit: (data: DreamPreciseFormData) => void;
  onClose: () => void;
  initialData?: Partial<DreamPreciseFormData>;
  busy?: boolean;
  className?: string;
}

const FIELDS: Array<{
  key: keyof DreamPreciseFormData;
  label: string;
  placeholder: string;
  required: boolean;
  rows: number;
}> = [
  {
    key: "core",
    label: "核心场景",
    placeholder: "梦里发生的最主要场景是什么？比如：考试 / 飞翔 / 被追赶…",
    required: true,
    rows: 3,
  },
  {
    key: "emotion",
    label: "情绪感受",
    placeholder: "醒来时的感受：紧张 / 平静 / 失落 / 兴奋…",
    required: true,
    rows: 2,
  },
  {
    key: "reality",
    label: "现实关联",
    placeholder: "选填：最近现实中是否有相似情境？",
    required: false,
    rows: 2,
  },
  {
    key: "special",
    label: "特殊符号",
    placeholder: "选填：梦里反复出现的物 / 颜色 / 数字…",
    required: false,
    rows: 2,
  },
];

const EMPTY_FORM: DreamPreciseFormData = {
  core: "",
  emotion: "",
  reality: "",
  special: "",
};

/**
 * 解梦精准模式 fullscreen modal（M2.10，spec §4.4 dream_precise_form）
 *
 * - 4 textarea：core / emotion / reality / special
 * - core + emotion 必填；reality + special 选填
 * - submit 前校验必填项；onSubmit 收到完整 4 字段对象
 * - M4 加紫蓝夜空 + 月亮 SVG 仪式特化
 */
export function DreamPreciseModal({
  open,
  onSubmit,
  onClose,
  initialData,
  busy,
  className,
}: DreamPreciseModalProps) {
  const [form, setForm] = React.useState<DreamPreciseFormData>(() => ({
    ...EMPTY_FORM,
    ...initialData,
  }));
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setForm({ ...EMPTY_FORM, ...initialData });
      setTouched(false);
    }
  }, [open, initialData]);

  const isValid = form.core.trim().length > 0 && form.emotion.trim().length > 0;

  const handleSubmit = React.useCallback(() => {
    setTouched(true);
    if (!isValid || busy) return;
    onSubmit({ ...form });
  }, [busy, form, isValid, onSubmit]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="精准解梦"
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-paper)]",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-[var(--color-accent-lavender)]/30 px-4 py-3">
        <h2 className="font-[family-name:var(--font-serif)] text-base tracking-ritual text-[var(--color-ink-plum)]">
          精准解梦
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="rounded-full px-2 py-1 text-[12px] text-[var(--color-ink-fade)] hover:bg-[var(--color-accent-lavender)]/20"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-[12px] text-[var(--color-ink-fade)]">
          填得越细，AI 三视角解读越准确。
        </p>
        {FIELDS.map((field) => {
          const value = form[field.key];
          const showError = touched && field.required && value.trim().length === 0;
          return (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={`dream-${field.key}`}
                className="flex items-center gap-1.5 text-[12px] tracking-ritual2 text-[var(--color-ink-plum)]"
              >
                {field.label}
                {field.required && (
                  <span aria-hidden className="text-[var(--color-wuxing-fire)]">
                    *
                  </span>
                )}
              </label>
              <textarea
                id={`dream-${field.key}`}
                aria-label={field.label}
                value={value}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={field.placeholder}
                rows={field.rows}
                disabled={busy}
                className={cn(
                  "w-full resize-none rounded-[10px] border bg-white/40 px-3 py-2 text-sm text-[var(--color-ink-plum)] placeholder:text-[var(--color-ink-fade)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-plum)]/40",
                  showError
                    ? "border-[var(--color-wuxing-fire)]/60"
                    : "border-[var(--color-accent-lavender)]/40",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              />
              {showError && (
                <p className="text-[11px] text-[var(--color-wuxing-fire)]">
                  请填写{field.label}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <footer className="border-t border-[var(--color-accent-lavender)]/30 px-4 py-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className={cn(
            "w-full rounded-full px-4 py-2.5 text-sm font-[family-name:var(--font-serif)] tracking-ritual transition-colors",
            "bg-[var(--color-accent-plum)] text-white hover:opacity-90",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          精准解梦
        </button>
      </footer>
    </div>
  );
}
