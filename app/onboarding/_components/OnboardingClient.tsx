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
  /** 指定 PUT 目标 profile id（/me/profiles/[id]/edit 用） */
  profileId?: string;
  /** true → POST 新建非默认档案（/me/profiles/new 用） */
  createMode?: boolean;
  /** 提交成功后跳转路径 */
  redirectTo?: string;
  /** 自定义成功提示 */
  successMessage?: string;
  /** 当前已有头像 URL（用于 step1 AvatarPicker 预填） */
  avatarUrl?: string | null;
}

/**
 * Onboarding 3 步 wizard 客户端组件
 *
 * 三种使用形态：
 * - 首次引导：/onboarding（无 props）→ Step3 找 default 占位档 PUT
 * - 编辑特定档案：/me/edit, /me/profiles/[id]/edit → 传 initial + profileId + editing
 * - 新建多档案：/me/profiles/new → 传 createMode → POST is_default=false
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
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [form, setForm] = React.useState<Partial<OnboardingForm>>(initial ?? {});

  if (step === 1) {
    return (
      <Step1Identity
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

  return (
    <Step3Confirm
      form={parsed.data}
      onPrev={() => setStep(2)}
      editing={editing}
      profileId={profileId}
      createMode={createMode}
      redirectTo={redirectTo}
      successMessage={successMessage}
    />
  );
}
