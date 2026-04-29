import { OnboardingClient } from "@/app/onboarding/_components/OnboardingClient";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";

/**
 * /me/profiles/new — 新建非默认档案（A3 多档案）
 *
 * 走 OnboardingClient createMode，Step3 时 POST /api/me/profiles
 * （is_default=false）。成功后跳 /me/profiles 列表。
 */
export const dynamic = "force-dynamic";

export default async function NewProfilePage() {
  try {
    await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return <LoginGate />;
    throw e;
  }

  return (
    <OnboardingClient
      createMode
      redirectTo="/me/profiles"
      successMessage="档案已新建"
    />
  );
}
