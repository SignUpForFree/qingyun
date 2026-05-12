"use client";

import * as React from "react";
import { Step1Profile } from "./Step1Profile";
import { Step3Confirm } from "./Step3Confirm";
import { onboardingSchema, type OnboardingForm } from "./schema";

interface Props {
  initial?: Partial<OnboardingForm>;
  editing?: boolean;
  profileId?: string;
  createMode?: boolean;
  redirectTo?: string;
  successMessage?: string;
  avatarUrl?: string | null;
}

/**
 * Onboarding 2 步 wizard
 *
 * Step 1：个人基础信息（昵称+性别+出生+地点，合并旧 Step1+Step2）
 * Step 2：确认提交
 */
export function OnboardingClient({
  initial,
  editing,
  profileId,
  createMode,
  redirectTo,
  successMessage,
  avatarUrl,
}: Props) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [form, setForm] = React.useState<Partial<OnboardingForm>>(initial ?? {});

  if (step === 1) {
    return (
      <Step1Profile
        initial={form}
        editing={editing}
        avatarUrl={avatarUrl}
        profileId={profileId}
        onNext={(v) => {
          setForm((prev) => ({ ...prev, ...v }));
          setStep(2);
        }}
      />
    );
  }

  const parsed = onboardingSchema.safeParse(form);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-[var(--color-ink-fade)]">
        信息不完整，请
        <button
          onClick={() => setStep(1)}
          className="text-[var(--color-accent-plum)] underline"
        >
          重新填写
        </button>
        。
      </div>
    );
  }

  return (
    <Step3Confirm
      form={parsed.data}
      onPrev={() => setStep(1)}
      editing={editing}
      profileId={profileId}
      createMode={createMode}
      redirectTo={redirectTo}
      successMessage={successMessage}
    />
  );
}
