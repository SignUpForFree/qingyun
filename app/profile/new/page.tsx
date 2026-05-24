import { OnboardingClient } from "@/app/onboarding/_components/OnboardingClient";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";

/**
 * /profile/new — 首页独立入口新建档案（保存后回 /profile 列表）
 */
export const dynamic = "force-dynamic";

export default async function HomeNewProfilePage() {
  try {
    await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return <LoginGate />;
    throw e;
  }

  return (
    <OnboardingClient
      createMode
      redirectTo="/profile"
      successMessage="档案已新建"
    />
  );
}
