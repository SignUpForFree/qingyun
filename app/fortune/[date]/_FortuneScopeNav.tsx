"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DayWeekMonthSwitcher,
  type FortuneScope,
} from "@/components/fortune/DayWeekMonthSwitcher";
import { DateRangeStrip } from "@/components/fortune/DateRangeStrip";

interface FortuneScopeNavProps {
  date: string;
}

/**
 * 详细页顶部 scope + 日期 strip 组合 (M4.5/M4.7)
 *
 * - scope 切换暂只切 day（week/month 留给 V2.1）
 * - 日期点击 → router.push("/fortune/<iso>")
 */
export function FortuneScopeNav({ date }: FortuneScopeNavProps) {
  const router = useRouter();
  const [scope, setScope] = useState<FortuneScope>("day");

  function handleDateChange(next: string) {
    if (next === date) return;
    router.push(`/fortune/${next}`);
  }

  return (
    <div className="space-y-3">
      <DayWeekMonthSwitcher scope={scope} onChange={setScope} />
      {scope === "day" && (
        <DateRangeStrip value={date} onChange={handleDateChange} />
      )}
      {scope !== "day" && (
        <p className="text-center text-[11px] text-[var(--color-ink-fade)]">
          {scope === "week" ? "周运" : "月运"}视图正在打磨中
        </p>
      )}
    </div>
  );
}
