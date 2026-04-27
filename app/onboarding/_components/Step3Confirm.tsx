"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { GlassCard, Divider } from "@/components/su";
import { StepShell } from "./StepShell";
import { toProfilePatch, type OnboardingForm } from "./schema";

// 最小 zod schema — 只校验我们用到的字段。`.passthrough()` 让 M2/M4 增加新字段时
// 不破坏 onboarding 提交流程。
const ProfileListResponse = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        is_default: z.boolean(),
      })
      .passthrough(),
  ),
});

interface Step3Props {
  form: OnboardingForm;
  onPrev: () => void;
  editing?: boolean;
}

/**
 * V2.0 提交：
 *   1. GET /api/me/profiles —— 找当前用户的默认档（M1.7 已在 OAuth callback 创建占位）
 *   2. PUT /api/me/profiles/[defaultId] —— 用 onboarding 表单的字段覆盖占位
 *   3. 成功后跳 /（不再去 /me；首次引导完成回首页）
 */
export function Step3Confirm({ form, onPrev, editing }: Step3Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const listRes = await fetch("/api/me/profiles");
      if (!listRes.ok) {
        toast.error(`加载档案失败 (${listRes.status})`);
        return;
      }
      const parsed = ProfileListResponse.safeParse(await listRes.json());
      if (!parsed.success) {
        toast.error("加载档案失败：响应格式异常");
        return;
      }
      const defaultProfile = parsed.data.data.find((p) => p.is_default);
      if (!defaultProfile) {
        toast.error("默认档案缺失，请重新登录");
        return;
      }

      const patch = toProfilePatch(form);
      const res = await fetch(`/api/me/profiles/${defaultProfile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `提交失败 (${res.status})`);
        return;
      }
      toast.success(editing ? "档案已更新" : "档案已建好");
      router.replace("/");
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setSubmitting(false);
    }
  }

  const calendarLabel = form.birth.calendarType === "lunar" ? "农历" : "公历";
  const dateLabel =
    form.birth.calendarType === "lunar"
      ? `农历 ${form.birth.rawDate.year}-${form.birth.rawDate.month}-${form.birth.rawDate.day}`
      : form.birth.rawDate.year +
        "-" +
        String(form.birth.rawDate.month).padStart(2, "0") +
        "-" +
        String(form.birth.rawDate.day).padStart(2, "0");
  const hourLabel =
    form.birth.hour === null
      ? "时辰不知道（按正午占位）"
      : `${String(form.birth.hour).padStart(2, "0")}:00 起`;
  const districtLabel = form.region.district ? ` ${form.region.district}` : "";

  return (
    <StepShell
      step={3}
      total={3}
      title={editing ? "确认更新" : "确认信息"}
      desc={editing ? "改完就替换默认档案" : "信息无误即可建档"}
      nextLabel={editing ? "保存" : "提交并建档"}
      onPrev={onPrev}
      onNext={submit}
      loading={submitting}
    >
      <GlassCard className="space-y-3 p-4 text-sm" shadow="none">
        <Row label="昵称" value={form.nickname} />
        <Row label="性别" value={form.gender === "male" ? "男" : "女"} />
        <Divider />
        <Row label="出生日期" value={`${dateLabel} · ${calendarLabel}`} />
        <Row label="出生时辰" value={hourLabel} />
        <Divider />
        <Row label="出生地" value={`${form.region.province} ${form.region.city}${districtLabel}`} />
        <Row
          label="坐标"
          value={`${form.region.longitude.toFixed(4)}°E · ${form.region.latitude.toFixed(4)}°N`}
          subtle
        />
      </GlassCard>

      <p className="text-center text-xs text-[var(--color-ink-fade)]">
        八字解读不是命中注定，只是给当下一个看自己的角度。
      </p>
    </StepShell>
  );
}

function Row({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-[var(--color-ink-fade)]">{label}</span>
      <span
        className={
          subtle
            ? "text-xs text-[var(--color-ink-mist)]"
            : "text-sm text-[var(--color-ink-plum)]"
        }
      >
        {value}
      </span>
    </div>
  );
}
