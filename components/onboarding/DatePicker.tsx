"use client";

import * as React from "react";
import lunar from "lunar-javascript";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalendarType } from "@/types/domain";

const { Solar, Lunar } = lunar;

/**
 * 时辰选项 — 12 时辰 + 不知道
 *
 * 每个时辰对应起始小时；选"不知道"时存 12 (默认子时) + metadata.unknownHour=true。
 * 参考 spec §6.4.M1 第 2 步。
 */
const HOUR_OPTIONS = [
  { label: "子时 (23:00-01:00)", hour: 0, displayHour: 23 },
  { label: "丑时 (01:00-03:00)", hour: 1, displayHour: 1 },
  { label: "寅时 (03:00-05:00)", hour: 3, displayHour: 3 },
  { label: "卯时 (05:00-07:00)", hour: 5, displayHour: 5 },
  { label: "辰时 (07:00-09:00)", hour: 7, displayHour: 7 },
  { label: "巳时 (09:00-11:00)", hour: 9, displayHour: 9 },
  { label: "午时 (11:00-13:00)", hour: 11, displayHour: 11 },
  { label: "未时 (13:00-15:00)", hour: 13, displayHour: 13 },
  { label: "申时 (15:00-17:00)", hour: 15, displayHour: 15 },
  { label: "酉时 (17:00-19:00)", hour: 17, displayHour: 17 },
  { label: "戌时 (19:00-21:00)", hour: 19, displayHour: 19 },
  { label: "亥时 (21:00-23:00)", hour: 21, displayHour: 21 },
] as const;

const UNKNOWN_HOUR_VALUE = "unknown";

export interface DatePickerValue {
  /** 公历日期（即使用户选农历，也存对应公历），ISO 字符串 yyyy-mm-dd */
  solarDate: string;
  /** 用户选择时使用的历法 */
  calendarType: CalendarType;
  /** 时辰起始小时（0-23）；用户选"不知道"时为 null */
  hour: number | null;
  /** 用户原始输入（用于回显） — 农历或公历的年月日 */
  rawDate: { year: number; month: number; day: number };
}

export interface DatePickerProps {
  value: DatePickerValue | null;
  onChange: (value: DatePickerValue) => void;
  className?: string;
  /** 是否禁用：onSubmit 中可临时禁用 */
  disabled?: boolean;
}

const MIN_DATE = new Date("1900-01-01T00:00:00+08:00");
const MAX_DATE = new Date();

export function DatePicker({ value, onChange, className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // 公历选中日期（即使用户选农历，calendar 内部也按公历显示对应日期）
  const solarSelected = React.useMemo(() => {
    if (!value) return undefined;
    return new Date(`${value.solarDate}T00:00:00+08:00`);
  }, [value]);

  const calendarTypeLabel = value?.calendarType === "lunar" ? "农历" : "公历";
  const dateLabel = value
    ? formatDateLabel(value)
    : "选择出生日期";

  const handleCalendarTypeSwitch = (newType: CalendarType) => {
    if (!value) return;
    if (newType === value.calendarType) return;

    const next = convertCalendarType(value, newType);
    onChange(next);
  };

  const handleSolarPick = (picked: Date | undefined) => {
    if (!picked) return;
    const year = picked.getFullYear();
    const month = picked.getMonth() + 1;
    const day = picked.getDate();
    const solarDate = toIsoDate(year, month, day);

    const calendarType = value?.calendarType ?? "solar";

    if (calendarType === "lunar") {
      // 用户切到了农历模式选择 — Calendar 仍显示公历，但要把所选公历转为农历存入 rawDate
      const ld = Solar.fromYmd(year, month, day).getLunar();
      onChange({
        solarDate,
        calendarType,
        hour: value?.hour ?? null,
        rawDate: {
          year: ld.getYear(),
          month: ld.getMonth(),
          day: ld.getDay(),
        },
      });
    } else {
      onChange({
        solarDate,
        calendarType: "solar",
        hour: value?.hour ?? null,
        rawDate: { year, month, day },
      });
    }
  };

  const handleHourChange = (next: string | null) => {
    if (!value || next === null) return;
    const hour = next === UNKNOWN_HOUR_VALUE ? null : Number(next);
    onChange({ ...value, hour });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* 公历 / 农历 切换 */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleCalendarTypeSwitch("solar")}
          className={cn(
            "flex-1 rounded-[8px] px-3 py-2 text-sm transition-colors",
            (value?.calendarType ?? "solar") === "solar"
              ? "bg-[var(--color-accent-lavender)]/30 text-[var(--color-ink-plum)]"
              : "text-[var(--color-ink-fade)] hover:bg-[var(--color-accent-lavender)]/10",
          )}
        >
          公历
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleCalendarTypeSwitch("lunar")}
          className={cn(
            "flex-1 rounded-[8px] px-3 py-2 text-sm transition-colors",
            value?.calendarType === "lunar"
              ? "bg-[var(--color-accent-lavender)]/30 text-[var(--color-ink-plum)]"
              : "text-[var(--color-ink-fade)] hover:bg-[var(--color-accent-lavender)]/10",
          )}
        >
          农历
        </button>
      </div>

      {/* 日期 popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className="hairline glass flex w-full items-center justify-start gap-2 rounded-[8px] px-3 py-2 text-sm text-[var(--color-ink-plum)] hover:bg-[var(--color-accent-lavender)]/10 disabled:opacity-50"
        >
          <CalendarIcon className="h-4 w-4 opacity-60" />
          <span className={cn(!value && "text-[var(--color-ink-fade)]")}>{dateLabel}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="border-b px-3 py-2 text-xs text-[var(--color-ink-fade)]">
            {value?.calendarType === "lunar" ? (
              <>选择对应的<strong className="mx-1">公历</strong>日期，将自动换算为农历显示</>
            ) : (
              <>请选择出生的<strong className="mx-1">公历</strong>日期</>
            )}
          </div>
          <Calendar
            mode="single"
            selected={solarSelected}
            onSelect={(d) => {
              handleSolarPick(d);
              setOpen(false);
            }}
            captionLayout="dropdown"
            startMonth={MIN_DATE}
            endMonth={MAX_DATE}
            disabled={(d) => d > MAX_DATE || d < MIN_DATE}
          />
        </PopoverContent>
      </Popover>

      {/* 时辰 */}
      <Select
        value={value?.hour === null ? UNKNOWN_HOUR_VALUE : value?.hour?.toString() ?? ""}
        onValueChange={handleHourChange}
        disabled={disabled || !value}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="选择时辰" />
        </SelectTrigger>
        <SelectContent>
          {HOUR_OPTIONS.map((opt) => (
            <SelectItem key={opt.hour} value={opt.hour.toString()}>
              {opt.label}
            </SelectItem>
          ))}
          <SelectItem value={UNKNOWN_HOUR_VALUE}>不知道（按子时计算）</SelectItem>
        </SelectContent>
      </Select>

      {/* 历法 + 农历日期回显 */}
      {value && value.calendarType === "lunar" && (
        <p className="text-xs text-[var(--color-ink-fade)]">
          已选：农历 {value.rawDate.year} 年 {value.rawDate.month} 月 {value.rawDate.day} 日（公历{" "}
          {value.solarDate}）· {calendarTypeLabel}模式
        </p>
      )}
    </div>
  );
}

function toIsoDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function convertCalendarType(prev: DatePickerValue, target: CalendarType): DatePickerValue {
  if (target === prev.calendarType) return prev;

  if (target === "lunar") {
    // solar → lunar: rawDate 用 lunar 表示
    const [y, m, d] = prev.solarDate.split("-").map(Number);
    const ld = Solar.fromYmd(y, m, d).getLunar();
    return {
      ...prev,
      calendarType: "lunar",
      rawDate: { year: ld.getYear(), month: ld.getMonth(), day: ld.getDay() },
    };
  }

  // lunar → solar: rawDate 同步为 solar
  const [y, m, d] = prev.solarDate.split("-").map(Number);
  return {
    ...prev,
    calendarType: "solar",
    rawDate: { year: y, month: m, day: d },
  };
}

function formatDateLabel(value: DatePickerValue): string {
  if (value.calendarType === "lunar") {
    return `农历 ${value.rawDate.year}-${value.rawDate.month}-${value.rawDate.day}`;
  }
  return `${value.solarDate}`;
}

/** 测试 / 服务端构造 helper */
export function buildSolarDatePickerValue(
  year: number,
  month: number,
  day: number,
  hour: number | null = null,
): DatePickerValue {
  return {
    solarDate: toIsoDate(year, month, day),
    calendarType: "solar",
    hour,
    rawDate: { year, month, day },
  };
}

export function buildLunarDatePickerValue(
  year: number,
  month: number,
  day: number,
  hour: number | null = null,
): DatePickerValue {
  const solar = Lunar.fromYmd(year, month, day).getSolar();
  return {
    solarDate: toIsoDate(solar.getYear(), solar.getMonth(), solar.getDay()),
    calendarType: "lunar",
    hour,
    rawDate: { year, month, day },
  };
}
