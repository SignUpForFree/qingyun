"use client";

import * as React from "react";
import lunar from "lunar-javascript";
import Picker from "react-mobile-picker";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { CalendarType } from "@/types/domain";

const { Solar, Lunar } = lunar;
// LunarYear / LunarMonth 在 lunar-javascript 的 .d.ts 里没声明，但运行时存在。
// 仅 DatePicker 内部需要（计算闰月数 + 闰月日数），用类型守卫包一层避免 any 扩散。
interface LunarYearLike {
  fromYear(year: number): { getLeapMonth(): number };
}
interface LunarMonthLike {
  fromYm(year: number, month: number): { getDayCount(): number } | null;
}
const LunarYear = (lunar as unknown as { LunarYear: LunarYearLike }).LunarYear;
const LunarMonth = (lunar as unknown as { LunarMonth: LunarMonthLike }).LunarMonth;

/**
 * 时辰参考表（用户填具体小时后由 hour → 时辰自动判定，仅作回显）
 */
const HOUR_BRANCHES: ReadonlyArray<{ label: string; branch: number }> = [
  { label: "子时", branch: 0 },
  { label: "丑时", branch: 1 },
  { label: "寅时", branch: 3 },
  { label: "卯时", branch: 5 },
  { label: "辰时", branch: 7 },
  { label: "巳时", branch: 9 },
  { label: "午时", branch: 11 },
  { label: "未时", branch: 13 },
  { label: "申时", branch: 15 },
  { label: "酉时", branch: 17 },
  { label: "戌时", branch: 19 },
  { label: "亥时", branch: 21 },
];

function hourToBranchLabel(hour: number): string {
  if (hour === 23 || hour === 0) return "子时";
  const idx = HOUR_BRANCHES.findIndex((b) => hour >= b.branch && hour < b.branch + 2);
  return HOUR_BRANCHES[idx]?.label ?? "";
}

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear();
const MINUTE_STEP = 5;

export interface DatePickerValue {
  /** 公历日期（即使用户选农历，也存对应公历），ISO 字符串 yyyy-mm-dd */
  solarDate: string;
  /** 用户选择时使用的历法 */
  calendarType: CalendarType;
  /** 出生小时（0-23）；用户选"不知道"时为 null */
  hour: number | null;
  /** 出生分钟（0-59）；hour=null 时该字段也为 null */
  minute: number | null;
  /** 用户原始输入（用于回显） — 农历或公历的年月日 */
  rawDate: { year: number; month: number; day: number; isLeap?: boolean };
}

export interface DatePickerProps {
  value: DatePickerValue | null;
  onChange: (value: DatePickerValue) => void;
  className?: string;
  disabled?: boolean;
}

interface DraftPickerValue {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  /** 农历闰月开关："0" 非闰月 / "1" 闰月；公历模式始终为 "0" */
  isLeap: string;
  [key: string]: string;
}

/**
 * 出生日期选择 — 移动端滚轮风格（Sheet from bottom + react-mobile-picker 5 列年月日时分）
 *
 * - trigger 行：显示当前已选日期+时分，点击展开 Sheet
 * - Sheet 顶部：公历/农历 toggle
 * - Sheet 主体：5 列滚轮（年/月/日/时/分），日数随 年+月 联动
 * - Sheet 底部：「不知道时分」链接 + 取消/确定
 * - 不知道时分：hour=null/minute=null（toProfilePatch 时占位 12:00）
 */
export function DatePicker({ value, onChange, className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [calendarType, setCalendarType] = React.useState<CalendarType>(
    value?.calendarType ?? "solar",
  );
  const [draft, setDraft] = React.useState<DraftPickerValue>(() =>
    valueToDraft(value, calendarType),
  );

  // 外部 value 历法/日期变化时同步内部 calendarType + draft（编辑模式回填 / 切回 step 时）
  React.useEffect(() => {
    if (value) {
      setCalendarType(value.calendarType);
    }
  }, [value]);

  const openSheet = () => {
    if (disabled) return;
    setDraft(valueToDraft(value, value?.calendarType ?? calendarType));
    setCalendarType(value?.calendarType ?? "solar");
    setOpen(true);
  };

  const handleCalendarSwitch = (next: CalendarType) => {
    if (next === calendarType) return;
    // 切换历法：把当前 draft 表示的日期换成另一种历法的对应日
    setDraft((prev) => convertDraftCalendar(prev, calendarType, next));
    setCalendarType(next);
  };

  const handleConfirm = () => {
    const result = draftToValue(draft, calendarType);
    if (!result) return;
    onChange(result);
    setOpen(false);
  };

  const handleUnknownHour = () => {
    if (!value) {
      // 未选过日期就点「不知道时分」无意义；提示先选日期
      return;
    }
    onChange({ ...value, hour: null, minute: null });
    setOpen(false);
  };

  // 当年闰月数字（0 = 当年无闰月），仅农历模式有意义
  const draftYear = Number(draft.year);
  const draftMonth = Number(draft.month);
  const leapMonthOfYear = calendarType === "lunar" ? getLeapMonthOfYear(draftYear) : 0;
  const showLeapColumn = calendarType === "lunar" && leapMonthOfYear > 0 && leapMonthOfYear === draftMonth;

  // 当年/月不再是闰月候选时，把 isLeap 强制回 "0"，避免脏状态污染 draftToValue
  React.useEffect(() => {
    if (!showLeapColumn && draft.isLeap !== "0") {
      setDraft((prev) => ({ ...prev, isLeap: "0" }));
    }
  }, [showLeapColumn, draft.isLeap]);

  // 联动日数：年+月+闰月+历法变化时把超界的 day 截到最大
  const maxDay = daysInMonth(draftYear, draftMonth, calendarType, draft.isLeap === "1");
  React.useEffect(() => {
    setDraft((prev) => {
      const dayNum = Number(prev.day);
      const max = daysInMonth(
        Number(prev.year),
        Number(prev.month),
        calendarType,
        prev.isLeap === "1",
      );
      if (dayNum > max) {
        return { ...prev, day: pad2(max) };
      }
      return prev;
    });
  }, [draft.year, draft.month, draft.isLeap, calendarType]);

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={openSheet}
        data-testid="onboarding-birth-trigger"
        className={cn(
          "flex w-full items-center gap-2 rounded-[8px] border border-input bg-white px-3 py-2.5 text-sm transition-colors",
          "hover:bg-[var(--color-accent-lavender)]/10 disabled:opacity-50",
          value ? "text-[var(--color-ink-plum)]" : "text-[var(--color-ink-fade)]",
        )}
      >
        <CalendarIcon className="h-4 w-4 opacity-60" />
        <span className="flex-1 text-left">
          {value ? formatTriggerLabel(value) : "选择出生日期与时分"}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-[16px] border-t border-[var(--color-accent-lavender)]/30 bg-[var(--color-bg-paper)] p-0"
        >
          <SheetHeader className="space-y-2 border-b border-[var(--color-accent-lavender)]/20 pb-3">
            <SheetTitle className="text-center font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-[var(--color-ink-plum)]">
              出生日期与时分
            </SheetTitle>
            <SheetDescription className="sr-only">
              请滚动选择年、月、日、时、分
            </SheetDescription>
            <div className="mx-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleCalendarSwitch("solar")}
                className={cn(
                  "flex-1 rounded-[8px] px-3 py-1.5 text-sm transition-colors",
                  calendarType === "solar"
                    ? "bg-[var(--color-accent-lavender)]/30 text-[var(--color-ink-plum)]"
                    : "text-[var(--color-ink-fade)] hover:bg-[var(--color-accent-lavender)]/10",
                )}
              >
                公历
              </button>
              <button
                type="button"
                onClick={() => handleCalendarSwitch("lunar")}
                className={cn(
                  "flex-1 rounded-[8px] px-3 py-1.5 text-sm transition-colors",
                  calendarType === "lunar"
                    ? "bg-[var(--color-accent-lavender)]/30 text-[var(--color-ink-plum)]"
                    : "text-[var(--color-ink-fade)] hover:bg-[var(--color-accent-lavender)]/10",
                )}
              >
                农历
              </button>
            </div>
          </SheetHeader>

          <div
            className="relative px-2 py-3"
            data-testid="onboarding-birth-wheel"
          >
            {/* 中央选中行高亮（pointer-events-none 让滚动不被吞） */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-2 right-2 top-1/2 z-10 h-8 -translate-y-1/2 rounded-[8px] bg-[var(--color-accent-lavender)]/20 ring-1 ring-[var(--color-accent-lavender)]/40"
            />
            <Picker
              value={draft}
              onChange={(next) => setDraft(next as DraftPickerValue)}
              height={200}
              itemHeight={32}
              wheelMode="natural"
            >
              <Picker.Column name="year">
                {yearOptions().map((y) => (
                  <Picker.Item key={y} value={pad4(y)}>
                    {pad4(y)} 年
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="month">
                {monthOptions().map((m) => (
                  <Picker.Item key={m} value={pad2(m)}>
                    {pad2(m)} 月
                  </Picker.Item>
                ))}
              </Picker.Column>
              {showLeapColumn && (
                <Picker.Column name="isLeap">
                  <Picker.Item value="0">非闰</Picker.Item>
                  <Picker.Item value="1">闰月</Picker.Item>
                </Picker.Column>
              )}
              <Picker.Column name="day">
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <Picker.Item key={d} value={pad2(d)}>
                    {pad2(d)} 日
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="hour">
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <Picker.Item key={h} value={pad2(h)}>
                    {pad2(h)} 时
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="minute">
                {minuteOptions().map((m) => (
                  <Picker.Item key={m} value={pad2(m)}>
                    {pad2(m)} 分
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
          </div>

          <SheetFooter className="flex-row items-center gap-2 border-t border-[var(--color-accent-lavender)]/20 p-3">
            <button
              type="button"
              onClick={handleUnknownHour}
              disabled={!value}
              className="text-[12px] text-[var(--color-accent-plum)] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              不知道时分
            </button>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                className="bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] text-white hover:opacity-90"
              >
                确定
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ───────── helpers ─────────

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

function yearOptions(): number[] {
  const out: number[] = [];
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) out.push(y);
  return out;
}

function monthOptions(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

function minuteOptions(): number[] {
  return Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
}

function daysInMonth(
  year: number,
  month: number,
  calendarType: CalendarType = "solar",
  isLeap = false,
): number {
  if (!year || !month) return 31;
  if (calendarType === "lunar") {
    try {
      const lm = LunarMonth.fromYm(year, isLeap ? -month : month);
      return lm ? lm.getDayCount() : 30;
    } catch {
      return 30;
    }
  }
  return new Date(year, month, 0).getDate();
}

/**
 * 当年闰月数字（0 表示无闰月）。仅用于决定 DatePicker 是否渲染「闰」列。
 */
function getLeapMonthOfYear(year: number): number {
  if (!year) return 0;
  try {
    return LunarYear.fromYear(year).getLeapMonth() ?? 0;
  } catch {
    return 0;
  }
}

/**
 * DatePickerValue → 滚轮 draft 形态
 * - 农历模式下 draft 显示农历年月日；hour/minute 始终是 24 小时制
 * - hour=null（不知道）时 draft 用 12:00 占位（与 toProfilePatch 一致）
 */
function valueToDraft(
  value: DatePickerValue | null,
  calendarType: CalendarType,
): DraftPickerValue {
  if (!value) {
    // 默认 1995-01-01 12:00
    return {
      year: "1995",
      month: "01",
      day: "01",
      hour: "12",
      minute: "00",
      isLeap: "0",
    };
  }
  const display = value.rawDate;
  const isLeap = calendarType === "lunar" && value.calendarType === "lunar" && value.rawDate.isLeap === true;
  return {
    year: pad4(display.year),
    month: pad2(display.month),
    day: pad2(display.day),
    hour: pad2(value.hour ?? 12),
    minute: pad2(value.hour === null ? 0 : (value.minute ?? 0)),
    isLeap: isLeap ? "1" : "0",
  };
}

/**
 * draft + 当前历法 → DatePickerValue
 *
 * 农历模式：draft 是用户选的农历年月日，需要转成公历存到 solarDate
 * 公历模式：draft 是公历年月日，直接当 solarDate
 */
function draftToValue(
  draft: DraftPickerValue,
  calendarType: CalendarType,
): DatePickerValue | null {
  const year = Number(draft.year);
  const month = Number(draft.month);
  const day = Number(draft.day);
  const hour = Number(draft.hour);
  const minute = Number(draft.minute);
  if (!year || !month || !day) return null;

  if (calendarType === "lunar") {
    // 仅当当年该月确实是闰月时 isLeap 才能为真，否则强制 false
    const leapMonth = getLeapMonthOfYear(year);
    const isLeap = draft.isLeap === "1" && leapMonth > 0 && leapMonth === month;
    let solarDate: string;
    try {
      const sd = Lunar.fromYmd(year, isLeap ? -month : month, day).getSolar();
      solarDate = toIsoDate(sd.getYear(), sd.getMonth(), sd.getDay());
    } catch {
      return null;
    }
    return {
      solarDate,
      calendarType: "lunar",
      hour,
      minute,
      rawDate: { year, month, day, isLeap: isLeap || undefined },
    };
  }

  return {
    solarDate: toIsoDate(year, month, day),
    calendarType: "solar",
    hour,
    minute,
    rawDate: { year, month, day },
  };
}

/**
 * 历法切换时：把 draft 当前显示的日期按另一种历法重新表达
 *   prev=solar, next=lunar：solar y-m-d → lunar y-m-d
 *   prev=lunar, next=solar：lunar y-m-d → solar y-m-d
 */
function convertDraftCalendar(
  draft: DraftPickerValue,
  prev: CalendarType,
  next: CalendarType,
): DraftPickerValue {
  if (prev === next) return draft;
  const y = Number(draft.year);
  const m = Number(draft.month);
  const d = Number(draft.day);
  if (!y || !m || !d) return draft;
  try {
    if (next === "lunar") {
      const ld = Solar.fromYmd(y, m, d).getLunar();
      // lunar-javascript getMonth() 返回带符号月（闰月为负）
      const lm = ld.getMonth();
      const isLeap = lm < 0;
      return {
        ...draft,
        year: pad4(ld.getYear()),
        month: pad2(Math.abs(lm)),
        day: pad2(ld.getDay()),
        isLeap: isLeap ? "1" : "0",
      };
    }
    // 农历 → 公历：用 prev draft 中的 isLeap 决定
    const isLeap = draft.isLeap === "1";
    const sd = Lunar.fromYmd(y, isLeap ? -m : m, d).getSolar();
    return {
      ...draft,
      year: pad4(sd.getYear()),
      month: pad2(sd.getMonth()),
      day: pad2(sd.getDay()),
      isLeap: "0",
    };
  } catch {
    return draft;
  }
}

/** trigger 行展示文案：「公历 1995-05-15 10:30 · 巳时」/「农历 闰六月 1995-04-16 时分未填」 */
function formatTriggerLabel(value: DatePickerValue): string {
  const label = value.calendarType === "lunar" ? "农历" : "公历";
  const leapPrefix = value.calendarType === "lunar" && value.rawDate.isLeap ? "闰 " : "";
  const dateStr = `${pad4(value.rawDate.year)}-${pad2(value.rawDate.month)}-${pad2(value.rawDate.day)}`;
  if (value.hour === null) {
    return `${label} ${leapPrefix}${dateStr} · 时分未填`;
  }
  const time = `${pad2(value.hour)}:${pad2(value.minute ?? 0)}`;
  return `${label} ${leapPrefix}${dateStr} · ${time} · ${hourToBranchLabel(value.hour)}`;
}

/** 测试 / 服务端构造 helper */
export function buildSolarDatePickerValue(
  year: number,
  month: number,
  day: number,
  hour: number | null = null,
  minute: number | null = null,
): DatePickerValue {
  return {
    solarDate: toIsoDate(year, month, day),
    calendarType: "solar",
    hour,
    minute: hour === null ? null : (minute ?? 0),
    rawDate: { year, month, day },
  };
}

export function buildLunarDatePickerValue(
  year: number,
  month: number,
  day: number,
  hour: number | null = null,
  minute: number | null = null,
  isLeap = false,
): DatePickerValue {
  const solar = Lunar.fromYmd(year, isLeap ? -month : month, day).getSolar();
  return {
    solarDate: toIsoDate(solar.getYear(), solar.getMonth(), solar.getDay()),
    calendarType: "lunar",
    hour,
    minute: hour === null ? null : (minute ?? 0),
    rawDate: { year, month, day, isLeap: isLeap || undefined },
  };
}
