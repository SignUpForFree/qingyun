import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { Sparkle, WatercolorDot } from "@/components/su";
import {
  ProfileCardList,
  type ProfileCardItem,
} from "@/components/profile/ProfileCardList";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profile/repository";

/**
 * /me/profiles — A3 多档案管理列表
 *
 * 默认档置顶，其余按 created_at 升序。
 * 操作：编辑 / 设为默认 / 删除（默认档不可删）。底部 CTA 新建。
 */
export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect("/api/auth/wechat");
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
        left={
          <Link
            href="/me"
            aria-label="返回"
            className="flex h-8 w-8 items-center justify-center text-[var(--color-ink-mist)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        }
        title={
          <span className="flex items-center gap-1.5 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-plum)]">
            档 案 管 理 <Sparkle size={9} variant="asterisk" />
          </span>
        }
      />

      <div className="relative flex flex-1 flex-col overflow-hidden p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WatercolorDot color="lavender" size={140} className="absolute left-[8%] top-[10%]" />
          <WatercolorDot color="pink" size={120} className="absolute right-[10%] top-[20%]" />
          <WatercolorDot color="blue" size={140} className="absolute bottom-[20%] left-[35%]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-md space-y-3">
          <p className="text-center text-[12px] tracking-ritual text-[var(--color-ink-fade)]">
            默 认 档 案 用 于 首 页 运 势 与 抽 签 · 其 余 档 案 可 单 独 用 于 八 字 / 梅 花
          </p>
          <ProfileCardList profiles={items} />
        </div>
      </div>
    </>
  );
}
