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
 * 解梦精准模式 fullscreen modal（M2.10 + M4.25 仪式特化）
 *
 * - 4 textarea：core / emotion / reality / special
 * - core + emotion 必填；reality + special 选填
 * - submit 前校验必填项；onSubmit 收到完整 4 字段对象
 * - M4.25 紫蓝夜空底 + 月亮 / 星 SVG + 红朱方框「梦」落款，
 *   把"做梦/解梦"的神秘感与抽签卡米黄、八字盘古铜金区别开。
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
      data-testid="dream-precise-modal"
      className={cn("fixed inset-0 z-50 flex flex-col overflow-hidden", className)}
      style={{
        background:
          "linear-gradient(180deg, #1a1535 0%, #2d2466 50%, #4a3d8c 100%)",
      }}
    >
      <NightSkyDecor />

      <header className="relative z-10 flex items-center justify-between border-b border-[#d8c5ff]/20 px-4 py-3">
        <h2 className="font-[family-name:var(--font-serif)] text-base tracking-ritual text-[#f4ecda]">
          精准解梦
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="rounded-full px-2 py-1 text-[12px] text-[#d8c5ff]/85 hover:bg-[#d8c5ff]/15"
        >
          ✕
        </button>
      </header>

      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-[12px] text-[#d8c5ff]/85">
          填得越细，AI 三视角解读越准确。
        </p>
        {FIELDS.map((field) => {
          const value = form[field.key];
          const showError = touched && field.required && value.trim().length === 0;
          return (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={`dream-${field.key}`}
                className="flex items-center gap-1.5 text-[12px] tracking-ritual2 text-[#f4ecda]"
              >
                {field.label}
                {field.required && (
                  <span aria-hidden className="text-[#ffb3a8]">
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
                  "w-full resize-none rounded-[10px] border px-3 py-2 text-sm text-[#f4ecda] placeholder:text-[#d8c5ff]/55 focus:outline-none focus:ring-2 focus:ring-[#d8c5ff]/40",
                  "bg-[#1a1535]/55 backdrop-blur-sm",
                  showError ? "border-[#ffb3a8]/70" : "border-[#d8c5ff]/35",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              />
              {showError && (
                <p className="text-[11px] text-[#ffb3a8]">
                  请填写{field.label}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <footer className="relative z-10 border-t border-[#d8c5ff]/20 px-4 py-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className={cn(
            "w-full rounded-full px-4 py-2.5 text-sm font-[family-name:var(--font-serif)] tracking-ritual transition-colors",
            "bg-[#d8c5ff] text-[#2d2466] hover:bg-[#f4ecda]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          精准解梦
        </button>
      </footer>

      {/* M4.25 红朱方框「梦」落款印章（左下角，避免遮关闭按钮 / 提交按钮） */}
      <div
        aria-hidden
        data-testid="dream-seal"
        className="absolute bottom-16 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-md border-[1.5px]"
        style={{
          color: "rgba(168,51,51,0.78)",
          borderColor: "rgba(168,51,51,0.55)",
          fontFamily: "var(--font-serif)",
          fontSize: "14px",
          lineHeight: 1,
        }}
      >
        梦
      </div>
    </div>
  );
}

/**
 * 紫蓝夜空装饰：右上月亮 + 散布星点 + 弱光晕。
 * 全部 SVG 自画 + opacity 半透明，作为背景装饰不抢交互主体。
 */
function NightSkyDecor() {
  return (
    <>
      {/* 月亮 */}
      <svg
        aria-hidden
        data-testid="dream-moon"
        viewBox="0 0 60 60"
        className="absolute right-6 top-12 h-16 w-16 opacity-85"
      >
        <defs>
          <radialGradient id="dream-moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7d6" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#fff7d6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fff7d6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="30" cy="30" r="28" fill="url(#dream-moon-glow)" />
        {/* 月亮主体 + 残月遮罩做出弯月效果 */}
        <circle cx="30" cy="30" r="14" fill="#f4ecda" />
        <circle cx="36" cy="27" r="13" fill="#1a1535" />
      </svg>

      {/* 散布星点 */}
      <svg
        aria-hidden
        data-testid="dream-stars"
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-70"
      >
        {STAR_POSITIONS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#f4ecda"
            opacity={s.opacity}
          />
        ))}
      </svg>
    </>
  );
}

const STAR_POSITIONS: ReadonlyArray<{
  x: number;
  y: number;
  r: number;
  opacity: number;
}> = [
  { x: 8, y: 18, r: 0.6, opacity: 0.85 },
  { x: 22, y: 32, r: 0.4, opacity: 0.7 },
  { x: 38, y: 14, r: 0.5, opacity: 0.8 },
  { x: 54, y: 42, r: 0.3, opacity: 0.6 },
  { x: 72, y: 22, r: 0.5, opacity: 0.85 },
  { x: 88, y: 36, r: 0.4, opacity: 0.7 },
  { x: 14, y: 58, r: 0.5, opacity: 0.75 },
  { x: 28, y: 78, r: 0.3, opacity: 0.55 },
  { x: 46, y: 96, r: 0.5, opacity: 0.7 },
  { x: 64, y: 86, r: 0.4, opacity: 0.65 },
  { x: 82, y: 110, r: 0.5, opacity: 0.8 },
  { x: 18, y: 132, r: 0.4, opacity: 0.65 },
  { x: 36, y: 158, r: 0.5, opacity: 0.7 },
  { x: 58, y: 144, r: 0.3, opacity: 0.5 },
  { x: 78, y: 172, r: 0.5, opacity: 0.75 },
  { x: 92, y: 188, r: 0.4, opacity: 0.6 },
];
