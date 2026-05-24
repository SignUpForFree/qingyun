import { notFound } from "next/navigation";
import { OnboardingClient } from "@/app/onboarding/_components/OnboardingClient";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";
import { profileToOnboardingForm } from "@/lib/profile/to-onboarding-form";

/**
 * /profile/[id]/edit — 首页独立入口的档案编辑（保存后回 /profile 列表）
 */
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function HomeEditProfilePage({ params }: Params) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return <LoginGate />;
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
      avatarUrl={target.avatar_url}
      editing
      redirectTo="/profile"
      successMessage="档案已更新"
    />
  );
}
