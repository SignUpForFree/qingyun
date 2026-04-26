"use client";

import * as React from "react";
import { Step1Identity } from "./Step1Identity";
import { Step2BirthInfo } from "./Step2BirthInfo";
import { Step3Confirm } from "./Step3Confirm";
import { onboardingSchema, type OnboardingForm } from "./schema";

interface Props {
  /** 编辑模式下从已有 profile 转换出的预填值 */
  initial?: Partial<OnboardingForm>;
  /** 编辑模式下的提示文案（替换默认招呼） */
  editing?: boolean;
}

/**
 * Onboarding 3 步 wizard 客户端组件
 *
 * - 创建模式（initial 为空）：从 step 1 开始填
 * - 编辑模式（initial 有值）：所有步骤都用预填值，用户可逐步覆盖
 */
export function OnboardingClient({ initial, editing }: Props) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [form, setForm] = React.useState<Partial<OnboardingForm>>(initial ?? {});

  if (step === 1) {
    return (
      <Step1Identity
        initial={form}
        editing={editing}
        onNext={(v) => {
          setForm((prev) => ({ ...prev, ...v }));
          setStep(2);
        }}
      />
    );
  }

  if (step === 2) {
    return (
      <Step2BirthInfo
        initial={form}
        onPrev={() => setStep(1)}
        onNext={(v) => {
          setForm((prev) => ({ ...prev, ...v }));
          setStep(3);
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

  return <Step3Confirm form={parsed.data} onPrev={() => setStep(2)} editing={editing} />;
}
