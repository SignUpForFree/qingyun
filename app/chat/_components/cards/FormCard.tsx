"use client";
import * as React from "react";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

export interface FormField {
  key: string;
  label: string;
  /** title：与卡片顶部说明同系宋体主色；field：默认小字辅助色 */
  labelVariant?: "title" | "field";
  type?: "text" | "textarea" | "select" | "number";
  required?: boolean;
  max?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  maxValue?: number;
  /** 标签与输入框同一行（梅花报数等） */
  labelInline?: boolean;
  /** 字段容器额外 class（如段间距） */
  fieldClassName?: string;
}

const FORM_TITLE_LABEL_CLASS =
  "text-[15px] font-[family-name:var(--font-serif)] leading-relaxed tracking-ritual text-[var(--color-ink-plum)]";
const FORM_FIELD_LABEL_CLASS =
  "text-xs tracking-ritual2 text-[var(--color-ink-fade)]";
const FORM_INLINE_LABEL_CLASS =
  "text-[13px] tracking-ritual2 text-[var(--color-ink-fade)]";

export interface FormCardProps {
  title: string;
  fields: readonly FormField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => void;
  busy?: boolean;
  className?: string;
  /** 前 3 个数字字段横排（梅花报数） */
  fieldsLayout?: "default" | "triple-inline";
}

/**
 * 通用表单卡 — dream_precise / bazi_quick / meihua_number 等复用
 *
 * - 必填校验：required 字段空值时 submit 按钮 disabled
 * - max 字数自动截断
 * - 文本字段超过 50 字默认 textarea
 */
export function FormCard({
  title,
  fields,
  submitLabel,
  onSubmit,
  busy,
  className,
  fieldsLayout = "default",
}: FormCardProps) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );

  const setField = (key: string, raw: string) => {
    const f = fields.find((x) => x.key === key);
    const truncated = f?.max ? raw.slice(0, f.max) : raw;
    setValues((prev) => ({ ...prev, [key]: truncated }));
  };

  const canSubmit =
    !busy &&
    fields.every((f) => !f.required || (values[f.key] ?? "").trim().length > 0);

  const useTripleInline = fieldsLayout === "triple-inline" && fields.length >= 3;
  const inlineFields = useTripleInline ? fields.slice(0, 3) : [];
  const restFields = useTripleInline ? fields.slice(3) : fields;

  const renderField = (f: FormField) => {
    const inlineLabel = Boolean(f.labelInline && f.label.trim().length > 0);
    const labelEl =
      f.label.trim().length > 0 ? (
        <label
          htmlFor={inlineLabel ? `form-${f.key}` : undefined}
          className={cn(
            inlineLabel && "shrink-0 whitespace-nowrap",
            inlineLabel
              ? FORM_INLINE_LABEL_CLASS
              : f.labelVariant === "title"
                ? FORM_TITLE_LABEL_CLASS
                : FORM_FIELD_LABEL_CLASS,
          )}
        >
          {f.label}
          {f.required && !inlineLabel && (
            <span className="ml-0.5 text-[var(--color-wuxing-fire)]">*</span>
          )}
        </label>
      ) : null;

    const inputEl =
      f.type === "textarea" || (f.max !== undefined && f.max > 50) ? (
        <textarea
          id={inlineLabel ? undefined : `form-${f.key}`}
          rows={3}
          value={values[f.key] ?? ""}
          disabled={busy}
          placeholder={f.placeholder ?? f.label}
          onChange={(e) => setField(f.key, e.target.value)}
          className="w-full resize-none rounded-[10px] border border-[var(--color-accent-lavender)]/30 bg-white/40 px-3 py-2 text-sm text-[var(--color-ink-plum)] placeholder:text-[var(--color-ink-fade)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-lavender)]"
        />
      ) : f.type === "select" ? (
        <select
          id={inlineLabel ? undefined : `form-${f.key}`}
          value={values[f.key] ?? ""}
          disabled={busy}
          onChange={(e) => setField(f.key, e.target.value)}
          className="w-full rounded-[10px] border border-[var(--color-accent-lavender)]/30 bg-white/40 px-3 py-2 text-sm text-[var(--color-ink-plum)]"
        >
          <option value="">（选择）</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`form-${f.key}`}
          type="text"
          inputMode={f.type === "number" ? "numeric" : undefined}
          value={values[f.key] ?? ""}
          disabled={busy}
          placeholder={f.placeholder ?? f.label}
          min={f.min}
          max={f.maxValue}
          onChange={(e) => {
            let next = e.target.value;
            if (f.type === "number") {
              next = next.replace(/\D/g, "").slice(0, 2);
            }
            setField(f.key, next);
          }}
          className={cn(
            "w-full rounded-[10px] border border-[var(--color-accent-lavender)]/30 bg-white/40 px-3 py-2 text-sm text-[var(--color-ink-plum)]",
            f.type === "number"
              ? "placeholder:text-xs placeholder:text-[var(--color-ink-fade)]"
              : "placeholder:text-[var(--color-ink-fade)]",
          )}
        />
      );

    return (
      <div
        key={f.key}
        className={cn(
          inlineLabel ? "flex items-center gap-2" : "space-y-1",
          f.fieldClassName,
        )}
      >
        {inlineLabel ? (
          <>
            {labelEl}
            <div className="min-w-0 flex-1">{inputEl}</div>
          </>
        ) : (
          <>
            {labelEl}
            {inputEl}
          </>
        )}
        {f.max && f.type !== "number" && (
          <p
            className={cn(
              "text-right text-[10px]",
              inlineLabel && "col-span-2 w-full",
              (values[f.key] ?? "").length >= f.max
                ? "text-red-400"
                : "text-[var(--color-ink-fade)]",
            )}
          >
            {(values[f.key] ?? "").length >= f.max
              ? "超出字数限制，请精简内容"
              : `${(values[f.key] ?? "").length} / ${f.max}`}
          </p>
        )}
      </div>
    );
  };

  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      {title.trim().length > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className={cn("whitespace-pre-wrap", FORM_TITLE_LABEL_CLASS)}>
            {title}
          </p>
          <Sparkle size={10} variant="diamond" />
        </div>
      ) : null}
      {useTripleInline ? (
        <div className="grid grid-cols-3 gap-2">
          {inlineFields.map((f) => renderField(f))}
        </div>
      ) : null}
      {restFields.map((f) => renderField(f))}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(values)}
        className={cn(
          "h-11 w-full rounded-[10px] transition-all",
          "bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] text-white shadow-pill",
          "font-[family-name:var(--font-serif)] text-sm tracking-ritual",
          "hover:opacity-90 active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {busy ? "提交中…" : submitLabel}
      </button>
    </GlassCard>
  );
}
