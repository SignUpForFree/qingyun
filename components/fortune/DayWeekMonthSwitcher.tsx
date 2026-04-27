"use client";

export type FortuneScope = "day" | "week" | "month";

interface DayWeekMonthSwitcherProps {
  scope: FortuneScope;
  onChange: (next: FortuneScope) => void;
}

const SEGMENTS: ReadonlyArray<{ key: FortuneScope; label: string }> = [
  { key: "day", label: "日运" },
  { key: "week", label: "周运" },
  { key: "month", label: "月运" },
];

/**
 * 日 / 周 / 月 三段切换 (M4.5, image3)
 *
 * 受控组件：父组件持 scope，传 onChange。三段平分宽度，被选中段紫渐变。
 */
export function DayWeekMonthSwitcher({ scope, onChange }: DayWeekMonthSwitcherProps) {
  return (
    <div
      className="flex w-full overflow-hidden rounded-full border border-[var(--color-accent-lavender)]/30 bg-[var(--color-paper)]/60 p-1"
      data-testid="day-week-month-switcher"
      role="tablist"
    >
      {SEGMENTS.map((seg) => {
        const active = seg.key === scope;
        return (
          <button
            key={seg.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            data-testid={`switcher-${seg.key}`}
            onClick={() => onChange(seg.key)}
            className={
              "flex-1 rounded-full py-1.5 text-[12px] tracking-ritual transition " +
              (active
                ? "bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-white shadow-pill"
                : "text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]")
            }
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
