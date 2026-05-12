"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  DayWeekMonthSwitcher,
  type FortuneScope,
} from "@/components/fortune/DayWeekMonthSwitcher";
import { DateRangeStrip } from "@/components/fortune/DateRangeStrip";
import {
  parseFortuneScope,
  type FortuneDetailScope,
} from "@/lib/fortune/fortune-scope";

interface FortuneScopeNavProps {
  date: string;
}

function buildFortunePath(nextDate: string, scope: FortuneDetailScope): string {
  if (scope === "day") return `/fortune/${nextDate}`;
  return `/fortune/${nextDate}?scope=${scope}`;
}

/**
 * 运势详情：日/周/月 scope 与地址栏 `?scope=` 同步；换日保留当前 scope。
 * 周运/月运与「日」使用不同计算（见 lib/fortune/fetch-fortune-detail.ts）。
 */
export function FortuneScopeNav({ date }: FortuneScopeNavProps) {
  const router = useRouter();
  const raw = useSearchParams().get("scope");
  const scope = parseFortuneScope(raw ?? undefined) as FortuneScope;

  function handleDateChange(next: string) {
    if (next === date) return;
    router.push(buildFortunePath(next, scope));
  }

  function handleScopeChange(next: FortuneDetailScope) {
    if (next === scope) return;
    router.push(buildFortunePath(date, next));
  }

  return (
    <div className="space-y-3">
      <DayWeekMonthSwitcher scope={scope} onChange={handleScopeChange} />
      <DateRangeStrip value={date} onChange={handleDateChange} />
    </div>
  );
}

export function FortuneScopeNavFallback() {
  return (
    <div
      className="h-[88px] animate-pulse rounded-2xl bg-[var(--color-accent-lavender)]/15"
      aria-hidden
    />
  );
}
