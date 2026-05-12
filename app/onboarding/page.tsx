import { OnboardingClient } from "./_components/OnboardingClient";
import { getCurrentUserId } from "@/lib/auth/session";
import { ensureUserWithPlaceholderProfile } from "@/lib/auth/ensure-placeholder-profile";

/**
 * Onboarding 入口（RSC）
 *
 * V2.0 (M1.11)：首次登录引导。M1.7 OAuth callback 已为新用户创建占位默认档
 * （gender=other / birth_date=1990-01-01 / birth_time=12:00 / birth_place="未填"），
 * 本页让用户用真实信息覆盖占位，提交时走 PUT /api/me/profiles/[defaultId]。
 *
 * 2026-05-04 修复 "默认档案缺失，请重新登录"：
 *   有些登录路径（旧 cookie / db reset 后 / 第三方 OAuth bug）会让用户落到这里时
 *   db 里没有任何 profile（哪怕占位档也没）。Step3 GET list 找不到 default →
 *   报错让用户重登 = 体验差。
 *   修法：进 onboarding 时若已有 cookie 就 server 端 ensureUserWithPlaceholderProfile
 *   兜底（幂等：user 已存在或已有 profile 则 no-op）。无 cookie 的用户保持原行为，
 *   提交时 apiFetch 401 → LoginSheet 弹登录窗。
 *
 * 注意：RSC 不能 set cookie，所以**不**主动建 cookie；只补 db 占位档。
 *
 * 编辑模式（?edit=1 → 从已有档案预填）已下线：M1.11 阶段一律以空白表单进入。
 * TODO(M1.12 /me): /me 页面将提供独立的「编辑档案」UX（多档案 CRUD）。
 */
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userId = await getCurrentUserId();
  if (userId) {
    try {
      ensureUserWithPlaceholderProfile(userId);
    } catch (e) {
      console.error("[onboarding] ensure placeholder profile failed", e);
    }
  }
  return <OnboardingClient />;
}
