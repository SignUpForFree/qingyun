import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { getCurrentProfile } from "@/lib/profile/current";

/**
 * /me 页 — 档案信息 + 入口列表（spec §9）
 *
 * P1 阶段：
 *   - 已建档 → 显示档案 + 入口（编辑/历史/反馈/关于占位）
 *   - 未建档（含 .env 缺失 / supabase 未接入 / RLS 拦截）→ 引导建档
 *
 * 入口 4 行：
 *   - 编辑档案：跳 /onboarding（V1.1 改为 /me/edit 真实编辑）
 *   - 历史记录：跳 /chat（在 chat 页打开 HistoryDrawer）
 *   - 吐槽反馈：P3 P1 实装 /feedback；占位先 disabled
 *   - 关于轻运：占位静态页 /about（P3 加）
 */
export const dynamic = "force-dynamic";

interface MenuItem {
  label: string;
  href: string;
  note: string;
  disabled?: boolean;
}

const MENU: readonly MenuItem[] = [
  { label: "编辑档案", href: "/onboarding?edit=1", note: "改完会替换默认档案" },
  { label: "历史记录", href: "/chat", note: "在对话页打开历史抽屉" },
  { label: "吐槽反馈", href: "/feedback", note: "把哪不对劲告诉我们" },
  { label: "关于轻运", href: "/about", note: "项目说明与数据声明" },
];

export default async function MePage() {
  const profile = await safeGetProfile();

  return (
    <>
      <AppHeader title="我的" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {profile ? <ProfileCard profile={profile} /> : <NoProfileCard />}
        <MenuList />
        <p className="px-1 pt-2 text-center text-[10px] text-[var(--color-ink-fade)]">
          轻运 AI · 1 人 5 周 MVP · v0.1
        </p>
      </div>
    </>
  );
}

interface MinimalProfile {
  nickname: string | null;
  gender: "male" | "female" | null;
  birth_time: string | null;
  calendar_type: "solar" | "lunar" | null;
  birth_province: string | null;
  birth_city: string | null;
  birth_district: string | null;
}

function ProfileCard({ profile }: { profile: MinimalProfile }) {
  const dateLabel = profile.birth_time
    ? new Date(profile.birth_time).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const calendarLabel = profile.calendar_type === "lunar" ? "农历" : "公历";

  return (
    <GlassCard className="space-y-3 p-5">
      <div className="space-y-0.5">
        <h2 className="font-[family-name:var(--font-serif)] text-[18px] tracking-ritual text-[var(--color-ink-plum)]">
          {profile.nickname || "(未填昵称)"}
          <Sparkle size={10} className="ml-1.5" />
        </h2>
        <p className="text-[11px] text-[var(--color-ink-fade)]">
          性别 · {profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "—"}
        </p>
      </div>
      <Divider />
      <Row label="出生时间" value={`${dateLabel} · ${calendarLabel}`} />
      <Row
        label="出生地"
        value={[profile.birth_province, profile.birth_city, profile.birth_district]
          .filter(Boolean)
          .join(" ") || "—"}
      />
    </GlassCard>
  );
}

function NoProfileCard() {
  return (
    <GlassCard className="space-y-3 p-5 text-center">
      <h2 className="font-[family-name:var(--font-serif)] text-[18px] tracking-ritual2 text-[var(--color-ink-plum)]">
        还没有档案 <Sparkle size={10} />
      </h2>
      <p className="text-xs text-[var(--color-ink-fade)]">
        先建一份档案，AI 才能知道你的命盘
      </p>
      <Link
        href="/onboarding"
        className="inline-block rounded-[8px] bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] px-5 py-2 text-sm text-white shadow-pill"
      >
        去建档
      </Link>
    </GlassCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-[var(--color-ink-fade)]">{label}</span>
      <span className="text-sm text-[var(--color-ink-plum)]">{value}</span>
    </div>
  );
}

function MenuList() {
  return (
    <GlassCard className="overflow-hidden p-0">
      {MENU.map((item, idx) => (
        <div key={item.label}>
          {item.disabled ? (
            <DisabledRow label={item.label} note={item.note} />
          ) : (
            <Link
              href={item.href}
              className="flex h-12 items-center gap-3 px-4 transition-colors hover:bg-[var(--color-accent-lavender)]/10"
            >
              <span className="flex-1 font-[family-name:var(--font-serif)] text-sm text-[var(--color-ink-plum)]">
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)]" />
            </Link>
          )}
          {idx < MENU.length - 1 && (
            <div className="ml-4 h-[0.5px] bg-[var(--color-accent-lavender)]/30" />
          )}
        </div>
      ))}
    </GlassCard>
  );
}

function DisabledRow({ label, note }: { label: string; note: string }) {
  return (
    <div
      className="flex h-12 cursor-not-allowed items-center gap-3 px-4 opacity-50"
      title={note}
    >
      <span className="flex-1 font-[family-name:var(--font-serif)] text-sm text-[var(--color-ink-mist)]">
        {label}
      </span>
      <span className="text-[10px] text-[var(--color-ink-fade)]">{note}</span>
    </div>
  );
}

async function safeGetProfile() {
  try {
    return await getCurrentProfile();
  } catch (e) {
    console.error("/me 获取档案失败", e);
    return null;
  }
}
