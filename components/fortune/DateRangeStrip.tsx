"use client";

interface DateRangeStripProps {
  /** 当前选中日期 YYYY-MM-DD */
  value: string;
  /** 用于"今日"高亮基准；默认 new Date() */
  today?: Date;
  /** 7 天 strip 中心日期；默认与 value 同一周 */
  centerDate?: string;
  onChange: (date: string) => void;
}

/**
 * 7 天日期 strip (M4.5, image3)
 *
 * 横向 7 个 cell：以当前选中或 centerDate 为基准，前后 ±3 天 = 7 天窗口。
 * 今日 cell 紫色边框高亮，已选 cell 填充紫渐变。
 *
 * 月份切换暂未实现（spec 提"swipe shows ±7"），单测只 cover 同周内切换。
 */
export function DateRangeStrip({ value, today, centerDate, onChange }: DateRangeStripProps) {
  const todayDate = today ?? new Date();
  const todayIso = isoDate(todayDate);
  const center = centerDate ?? value;
  const days = sevenDays(center);

  return (
    <div className="grid grid-cols-7 gap-2" data-testid="date-range-strip">
      {days.map((d) => {
        const isToday = d.iso === todayIso;
        const isSelected = d.iso === value;
        return (
          <button
            key={d.iso}
            type="button"
            data-testid={`day-${d.iso}`}
            data-today={isToday}
            data-selected={isSelected}
            onClick={() => onChange(d.iso)}
            className={
              "flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 transition " +
              (isSelected
                ? "bg-gradient-to-b from-[#F0B8C8] to-[#C9A1D9] text-white shadow-pill"
                : "border border-transparent text-[var(--color-ink-mist)] hover:border-[var(--color-accent-lavender)]/35") +
              (isToday && !isSelected ? " border-[var(--color-accent-plum)]/55" : "")
            }
          >
            <span className="text-[10px] tracking-ritual">{WEEK_LABELS[d.weekday]}</span>
            <span className="font-[family-name:var(--font-serif)] text-[14px]">{d.day}</span>
          </button>
        );
      })}
    </div>
  );
}

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

interface DayCell {
  iso: string;
  day: number;
  weekday: number;
}

function sevenDays(centerIso: string): DayCell[] {
  const center = new Date(`${centerIso}T12:00:00Z`);
  const out: DayCell[] = [];
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(center);
    d.setUTCDate(d.getUTCDate() + offset);
    out.push({
      iso: isoDate(d),
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
    });
  }
  return out;
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
