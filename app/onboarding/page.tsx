import { OnboardingClient } from "./_components/OnboardingClient";
import type { OnboardingForm } from "./_components/schema";
import { getCurrentProfile } from "@/lib/profile/current";

/**
 * Onboarding 入口（RSC）
 *
 * - 创建模式（无现有 profile 或没传 ?edit=1）：空白表单
 * - 编辑模式（已有 profile 且 ?edit=1）：从 profile 反推预填到表单
 *   - 反推 ISO → year/month/day/hour
 *   - 历法回到 solar/lunar 标志
 *   - 省/市/区 + 经纬度
 *
 * 提交逻辑保持不变：POST /api/profile 内部已把旧 default 降级，再 insert
 * 新 profile + setCurrentProfileId
 */
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ edit?: string }>;
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const isEdit = sp.edit === "1";

  let initial: Partial<OnboardingForm> | undefined;
  if (isEdit) {
    try {
      const profile = await getCurrentProfile();
      if (profile) initial = profileToFormDefaults(profile);
    } catch (e) {
      console.error("/onboarding 编辑模式取档案失败", e);
    }
  }

  return <OnboardingClient initial={initial} editing={isEdit && !!initial} />;
}

interface ProfileLike {
  nickname: string | null;
  gender: "male" | "female" | null;
  birth_time: string | null;
  calendar_type: "solar" | "lunar" | null;
  birth_province: string | null;
  birth_city: string | null;
  birth_district: string | null;
  birth_longitude: number | null;
  birth_latitude: number | null;
}

function profileToFormDefaults(p: ProfileLike): Partial<OnboardingForm> | undefined {
  if (!p.birth_time) return undefined;
  const d = new Date(p.birth_time);
  if (Number.isNaN(d.getTime())) return undefined;

  // 用 +08:00 偏移提取年月日时（同 lib/bazi/today UTC8 思路）
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();

  return {
    nickname: p.nickname ?? "",
    gender: p.gender ?? undefined,
    birth: {
      iso: p.birth_time,
      calendarType: p.calendar_type ?? "solar",
      hour,
      rawDate: { year, month, day },
    },
    region:
      p.birth_province && p.birth_city
        ? {
            province: p.birth_province,
            city: p.birth_city,
            district: p.birth_district ?? undefined,
            longitude: p.birth_longitude ?? 0,
            latitude: p.birth_latitude ?? 0,
          }
        : undefined,
  };
}
