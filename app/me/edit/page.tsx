import { redirect } from "next/navigation";
import { OnboardingClient } from "@/app/onboarding/_components/OnboardingClient";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import { profileToOnboardingForm } from "@/lib/profile/to-onboarding-form";

/**
 * /me/edit — 编辑当前默认档案
 *
 * 复用 OnboardingClient 的 3 步 wizard，预填默认档案现有值，
 * Step3 提交时 PUT /api/me/profiles/[defaultId]，成功后回 /me。
 */
export const dynamic = "force-dynamic";

export default async function MeEditPage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect("/api/auth/wechat");
    throw e;
  }

  const list = await listProfiles(userId);
  const def = list.find((p) => p.is_default);
  if (!def) redirect("/onboarding");

  return (
    <OnboardingClient
      initial={profileToOnboardingForm(def)}
      profileId={def.id}
      avatarUrl={def.avatar_url}
      editing
      redirectTo="/me"
      successMessage="档案已更新"
    />
  );
}
