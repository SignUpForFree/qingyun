import Link from "next/link";
import { AppHeader } from "@/components/layout";
import {
  ProfileCardList,
  type ProfileCardItem,
} from "@/components/profile/ProfileCardList";
import { LoginGate } from "@/components/auth/LoginGate";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";

/**
 * /profile — 首页入口的独立档案列表（与 /me/profiles 同 UI、同 API）
 */
export const dynamic = "force-dynamic";

export default async function HomeProfilesPage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return <LoginGate />;
    throw e;
  }

  const list = await listProfiles(userId);
  const items: ProfileCardItem[] = list.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    gender: p.gender,
    birth_date: p.birth_date,
    birth_time: p.birth_time,
    birth_calendar: p.birth_calendar,
    birth_place: p.birth_place,
    is_default: p.is_default,
    avatar_url: p.avatar_url,
  }));

  return (
    <>
      <AppHeader
        title="档案信息"
        left={
          <Link
            href="/"
            aria-label="返回首页"
            className="text-[20px] text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
          >
            ←
          </Link>
        }
      />
      <div className="flex flex-1 flex-col p-4 pb-safe-bottom">
        <ProfileCardList profiles={items} routeBase="/profile" />
      </div>
    </>
  );
}
