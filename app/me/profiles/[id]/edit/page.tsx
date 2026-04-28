import { notFound, redirect } from "next/navigation";
import { OnboardingClient } from "@/app/onboarding/_components/OnboardingClient";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import { profileToOnboardingForm } from "@/lib/profile/to-onboarding-form";

/**
 * /me/profiles/[id]/edit — 编辑特定档案（默认或非默认都可）
 *
 * 校验：profile 必须属于当前 user（防越权）。
 */
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditProfilePage({ params }: Params) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect("/api/auth/wechat");
    throw e;
  }

  const { id } = await params;
  const list = await listProfiles(userId);
  const target = list.find((p) => p.id === id);
  if (!target) notFound();

  return (
    <OnboardingClient
      initial={profileToOnboardingForm(target)}
      profileId={target.id}
      editing
      redirectTo="/me/profiles"
      successMessage="档案已更新"
    />
  );
}
