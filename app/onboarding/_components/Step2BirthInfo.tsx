"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { DatePicker, type DatePickerValue } from "@/components/onboarding/DatePicker";
import { RegionPicker, type RegionPickerValue } from "@/components/onboarding/RegionPicker";
import { StepShell } from "./StepShell";
import type { OnboardingForm } from "./schema";

type Step2Value = Pick<OnboardingForm, "birth" | "region">;

interface Step2Props {
  initial: Partial<Step2Value>;
  onPrev: () => void;
  onNext: (value: Step2Value) => void;
}

export function Step2BirthInfo({ initial, onPrev, onNext }: Step2Props) {
  const [birthValue, setBirthValue] = React.useState<DatePickerValue | null>(
    initial.birth ? datePickerValueFromForm(initial.birth) : null,
  );
  const [region, setRegion] = React.useState<RegionPickerValue | null>(initial.region ?? null);

  const isValid = isBirthComplete(birthValue) && isRegionComplete(region);

  return (
    <StepShell
      step={2}
      total={3}
      title="你从哪来"
      desc="出生时间与地点 — 用于八字真太阳时换算"
      onPrev={onPrev}
      nextDisabled={!isValid}
      onNext={() => {
        if (!birthValue || !region) return;
        onNext({
          birth: formValueFromDatePicker(birthValue),
          region,
        });
      }}
    >
      <div className="space-y-2">
        <Label>出生日期与时分</Label>
        <DatePicker value={birthValue} onChange={setBirthValue} />
      </div>

      <div className="space-y-2">
        <Label>出生地</Label>
        <RegionPicker value={region} onChange={setRegion} />
      </div>
    </StepShell>
  );
}

function isBirthComplete(v: DatePickerValue | null): v is DatePickerValue {
  return Boolean(v && v.solarDate);
}

function isRegionComplete(v: RegionPickerValue | null): v is RegionPickerValue {
  return Boolean(v && v.province && v.city);
}

function formValueFromDatePicker(v: DatePickerValue): OnboardingForm["birth"] {
  // 用户未选时辰时 → 按子时（hour=0/minute=0）记，hour=null 留作 metadata 标记
  const hour = v.hour ?? 0;
  const minute = v.minute ?? 0;
  const iso = `${v.solarDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
  return {
    iso,
    calendarType: v.calendarType,
    hour: v.hour,
    minute: v.hour === null ? null : minute,
    rawDate: v.rawDate,
  };
}

function datePickerValueFromForm(b: OnboardingForm["birth"]): DatePickerValue {
  return {
    solarDate: b.iso.slice(0, 10),
    calendarType: b.calendarType,
    hour: b.hour,
    minute: b.minute,
    rawDate: b.rawDate,
  };
}
