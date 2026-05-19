"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { GlassCard, Divider } from "@/components/su";
import { StepShell } from "./StepShell";
import { toProfilePatch, type OnboardingForm } from "./schema";
import { apiFetch } from "@/lib/util/api-fetch";

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
  /** 指定 PUT 目标档案 id（编辑非默认档案时使用）；未传走 GET list 找 default */
  profileId?: string;
  /** true → POST 新建一条非默认档案（A3 多档案）；忽略 profileId */
  createMode?: boolean;
  /** 提交成功后跳转路径，默认 "/" */
  redirectTo?: string;
  /** 自定义成功 toast 文案 */
  successMessage?: string;
}

/**
 * V2.0 提交：
 *   - createMode=true → POST /api/me/profiles 新建非默认档案
 *   - profileId 已知 → PUT /api/me/profiles/[profileId] 覆盖
 *   - 都未指定 → GET 列表找 default（onboarding 首次引导路径）
 *   - 成功后 router.replace(redirectTo ?? "/")
 */
export function Step3Confirm({
  form,
  onPrev,
  editing,
  profileId,
  createMode,
  redirectTo,
  successMessage,
}: Step3Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const patch = toProfilePatch(form);

      if (createMode) {
        const res = await apiFetch("/api/me/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.error ?? `新建失败 (${res.status})`);
          return;
        }
        toast.success(successMessage ?? "档案已新建");
        router.replace(redirectTo ?? "/me/profiles");
        return;
      }

      let targetId = profileId;
      if (!targetId) {
        const listRes = await apiFetch("/api/me/profiles");
        if (!listRes.ok) {
          if (listRes.status === 401) {
            // apiFetch 已经 dispatch 弹登录窗，提示用户登录后重试
            toast.error("登录已过期，请登录后重试");
          } else {
            toast.error(`加载档案失败 (${listRes.status})`);
          }
          return;
        }
        const parsed = ProfileListResponse.safeParse(await listRes.json());
        if (!parsed.success) {
          toast.error("加载档案失败：响应格式异常");
          return;
        }
        const defaultProfile = parsed.data.data.find((p) => p.is_default);
        if (!defaultProfile) {
          // 兜底：找不到 default profile（onboarding RSC 应已 ensureUserWithPlaceholderProfile，
          // 但极端场景如 transaction 失败仍可能落到这里）→ 直接 POST 创建一条
          // server 端 createProfile 0 profile 时强制 is_default=true（修在 lib/profile/repository.ts）
          const createRes = await apiFetch("/api/me/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            toast.error(err?.error ?? `建档失败 (${createRes.status})`);
            return;
          }
          toast.success(successMessage ?? "档案已建好");
          router.replace(redirectTo ?? "/");
          return;
        }
        targetId = defaultProfile.id;
      }

      const res = await apiFetch(`/api/me/profiles/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `提交失败 (${res.status})`);
        return;
      }
      toast.success(successMessage ?? (editing ? "档案已更新" : "档案已建好"));
      router.replace(redirectTo ?? "/");
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setSubmitting(false);
    }
  }

  const calendarLabel = form.birth.calendarType === "lunar" ? "农历" : "公历";
  const leapPrefix = form.birth.calendarType === "lunar" && form.birth.rawDate.isLeap ? "闰 " : "";
  const dateLabel =
    form.birth.calendarType === "lunar"
      ? `农历 ${leapPrefix}${form.birth.rawDate.year}-${form.birth.rawDate.month}-${form.birth.rawDate.day}`
      : form.birth.rawDate.year +
        "-" +
        String(form.birth.rawDate.month).padStart(2, "0") +
        "-" +
        String(form.birth.rawDate.day).padStart(2, "0");
  const hourLabel =
    form.birth.hour === null
      ? "时分不知道（按正午占位）"
      : `${String(form.birth.hour).padStart(2, "0")}:${String(form.birth.minute ?? 0).padStart(2, "0")}`;
  const districtLabel = form.region.district ? ` ${form.region.district}` : "";

  return (
    <StepShell
      step={2}
      total={2}
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
