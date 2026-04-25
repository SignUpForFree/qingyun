"use client";

import * as React from "react";
import { Step1Identity } from "./_components/Step1Identity";
import { Step2BirthInfo } from "./_components/Step2BirthInfo";
import { Step3Confirm } from "./_components/Step3Confirm";
import { onboardingSchema, type OnboardingForm } from "./_components/schema";

/**
 * Onboarding 3 步 wizard 容器（spec §6.4.M1）
 *
 * 设计：
 *   - 表单状态由本页 useState 管理（不用 zustand / react-hook-form 整体管），
 *     单步内部用本地 state，提交后 merge 到父态
 *   - Step3 提交前用 onboardingSchema 兜底校验，挡住任何 step 跳过
 *   - hideNav：onboarding 是全屏流程，不显示 BottomNav（root layout 默认显示，
 *     这里不能用 AppShell hideNav，但 onboarding 路由加 BottomNav 视觉影响小，
 *     待 F4 完成视觉走查时再决定是否 hide）
 */
export default function OnboardingPage() {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [form, setForm] = React.useState<Partial<OnboardingForm>>({});

  if (step === 1) {
    return (
      <Step1Identity
        initial={form}
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

  // step === 3
  const parsed = onboardingSchema.safeParse(form);
  if (!parsed.success) {
    // 防御：理论上 step 1/2 校验后到 3 应该全合法
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-[var(--color-ink-fade)]">
        信息不完整，请<button onClick={() => setStep(1)} className="text-[var(--color-accent-plum)] underline">重新填写</button>。
      </div>
    );
  }

  return <Step3Confirm form={parsed.data} onPrev={() => setStep(2)} />;
}
