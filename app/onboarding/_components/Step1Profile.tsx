"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StepShell } from "./StepShell";
import type { OnboardingForm } from "./schema";
import { DatePicker, type DatePickerValue } from "@/components/onboarding/DatePicker";
import { RegionPicker, type RegionPickerValue } from "@/components/onboarding/RegionPicker";
import { AvatarPicker } from "@/components/profile/AvatarPicker";

type Step1Value = Pick<OnboardingForm, "nickname" | "gender" | "birth" | "region">;

/** 与 DatePicker / RegionPicker 触发行一致的白底输入框 */
const onboardingTextFieldClass =
  "w-full min-w-0 rounded-[8px] border border-input bg-white px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--color-ink-fade)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const fieldLabelClass = "text-[13px] text-[var(--color-ink-fade)]";

interface Step1Props {
  initial: Partial<OnboardingForm>;
  editing?: boolean;
  avatarUrl?: string | null;
  profileId?: string;
  onNext: (value: Step1Value) => void;
}

/**
 * Step 1：个人基础信息（合并旧 Step1 昵称+性别 + Step2 出生日期+地点）
 */
export function Step1Profile({
  initial,
  editing,
  avatarUrl,
  profileId,
  onNext,
}: Step1Props) {
  const [nickname, setNickname] = React.useState(initial.nickname ?? "");
  const [gender, setGender] = React.useState<Step1Value["gender"] | undefined>(initial.gender);

  const [birthValue, setBirthValue] = React.useState<DatePickerValue | null>(
    initial.birth ? datePickerValueFromForm(initial.birth) : null,
  );
  const [region, setRegion] = React.useState<RegionPickerValue | null>(initial.region ?? null);

  const identityValid = nickname.trim().length >= 1 && nickname.trim().length <= 20 && gender !== undefined;
  const birthValid = isBirthComplete(birthValue) && isRegionComplete(region);
  const valid = identityValid && birthValid;

  return (
    <StepShell
      step={1}
      total={2}
      title={editing ? "编辑档案" : "完善个人信息"}
      desc={editing ? "改完即替换默认档案" : "先认识一下，一步搞定"}
      nextDisabled={!valid}
      onNext={() => {
        if (!valid || !gender || !birthValue || !region) return;
        onNext({
          nickname: nickname.trim(),
          gender,
          birth: formValueFromDatePicker(birthValue),
          region,
        });
      }}
    >
      {/* 头像 */}
      <div className="flex flex-col items-center gap-1">
        <AvatarPicker
          currentUrl={avatarUrl ?? null}
          nickname={nickname || "我"}
          profileId={profileId}
          size={84}
        />
        <p className="text-[10px] text-[var(--color-ink-fade)]">点击上传头像</p>
      </div>

      {/* 昵称 */}
      <div className="space-y-2">
        <label htmlFor="nickname" className={fieldLabelClass}>
          如何称呼你
        </label>
        <input
          id="nickname"
          autoFocus
          maxLength={20}
          placeholder="昵称（最多 20 字）"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className={onboardingTextFieldClass}
        />
      </div>

      <div className="space-y-2">
        <span id="gender-label" className={fieldLabelClass}>
          性别（影响大运排法）
        </span>
        <div
          role="radiogroup"
          aria-labelledby="gender-label"
          className="grid grid-cols-2 gap-2"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setGender(gender === "male" ? "female" : "male");
            }
          }}
        >
          <GenderTile label="男" active={gender === "male"} onClick={() => setGender("male")} />
          <GenderTile label="女" active={gender === "female"} onClick={() => setGender("female")} />
        </div>
      </div>

      {/* 出生日期与时分 */}
      <div className="space-y-2">
        <label className={fieldLabelClass}>出生日期与时分</label>
        <DatePicker value={birthValue} onChange={setBirthValue} />
      </div>

      <div className="space-y-2">
        <label className={fieldLabelClass}>出生地</label>
        <RegionPicker value={region} onChange={setRegion} />
      </div>
    </StepShell>
  );
}

function GenderTile({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        "h-12 rounded-[8px] border text-sm transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-lavender)]",
        active
          ? "border-transparent bg-gradient-to-br from-[#F0B8C8]/40 to-[#C9A1D9]/40 text-[var(--color-ink-plum)] shadow-pill"
          : "border-[var(--color-accent-lavender)]/30 bg-white/40 text-[var(--color-ink-mist)] hover:bg-white/60",
      )}
    >
      {label}
    </button>
  );
}

function isBirthComplete(v: DatePickerValue | null): v is DatePickerValue {
  return Boolean(v && v.solarDate);
}

function isRegionComplete(v: RegionPickerValue | null): v is RegionPickerValue {
  return Boolean(v && v.province && v.city);
}

function formValueFromDatePicker(v: DatePickerValue): OnboardingForm["birth"] {
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
