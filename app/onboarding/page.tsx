import { OnboardingClient } from "./_components/OnboardingClient";

/**
 * Onboarding 入口（RSC）
 *
 * V2.0 (M1.11)：首次登录引导。M1.7 OAuth callback 已为新用户创建占位默认档
 * （gender=other / birth_date=1990-01-01 / birth_time=12:00 / birth_place="未填"），
 * 本页让用户用真实信息覆盖占位，提交时走 PUT /api/me/profiles/[defaultId]。
 *
 * 编辑模式（?edit=1 → 从已有档案预填）已下线：M1.11 阶段一律以空白表单进入。
 * TODO(M1.12 /me): /me 页面将提供独立的「编辑档案」UX（多档案 CRUD）。
 *
 * 中间件 (lib/auth/middleware.ts) 负责未登录态拦截，本页假定 session 已存在。
 */
export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return <OnboardingClient />;
}
