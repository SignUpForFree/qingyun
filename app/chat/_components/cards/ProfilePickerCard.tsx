"use client";
import * as React from "react";
import Link from "next/link";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";

export interface PickerProfile {
  id: string;
  nickname: string;
  isDefault: boolean;
  avatarUrl?: string;
  birthDate?: string;
  gender?: "male" | "female" | "other";
}

export interface ProfilePickerCardProps {
  profiles: readonly PickerProfile[];
  onPick: (profileId: string) => void;
  selectedId?: string;
  busy?: boolean;
  /** 当前 conversation id，用于 "添加新档案" 跳转回链 */
  conversationId?: string;
  /** 默认 true；为 false 时隐藏底部 "添加新档案" 链接 */
  allowAddNew?: boolean;
  title?: string;
  className?: string;
}

const GENDER_ICON: Record<NonNullable<PickerProfile["gender"]>, string> = {
  male: "♂",
  female: "♀",
  other: "·",
};

/**
 * A3 多档案选择卡（spec §4.5）
 *
 * 用于八字 / 梅花消息流：用户必须显式选档案，不走默认。
 *
 * - 默认档案 ⭐ + nickname 加 .default-profile 类（测试断言点）
 * - 出生信息显示 YYYY-MM 简略
 * - 底部 "添加新档案" → /me/profiles/new?return={current_url}
 */
export function ProfilePickerCard({
  profiles,
  onPick,
  selectedId,
  busy,
  conversationId,
  allowAddNew = true,
  title = "用谁的档案？",
  className,
}: ProfilePickerCardProps) {
  // default 排前；其余按 created_at desc（数据已排好则保持）
  const sorted = React.useMemo(
    () =>
      [...profiles].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
      }),
    [profiles],
  );

  // M4.11-21 多档案 wizard 推迟（依赖 china-division/COS/OTP 外部服务）。
  // 临时跳到 /onboarding 让用户用现有 wizard 建一个新档案——onboarding 写完会
  // 把新档置为 default，回 chat 后再换回原默认即可（用户可在 /me 切回）。
  const addNewHref = conversationId
    ? `/onboarding?return=${encodeURIComponent(`/chat?cid=${conversationId}`)}`
    : "/onboarding";

  return (
    <GlassCard className={cn("space-y-3 p-4", className)}>
      <p className="text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]">
        {title}
      </p>

      <div className="flex flex-col gap-2">
        {sorted.map((p) => {
          const isSelected = selectedId === p.id;
          const ymStr = p.birthDate?.slice(0, 7);
          return (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => !busy && onPick(p.id)}
              data-profile-id={p.id}
              className={cn(
                "flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors",
                "border-[var(--color-accent-lavender)]/30 bg-white/40",
                "hover:bg-[var(--color-accent-lavender)]/20",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isSelected && "ring-2 ring-[var(--color-accent-plum)]/50",
                p.isDefault && "default-profile",
              )}
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent-lavender)]/30">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatarUrl}
                    alt={p.nickname}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-[family-name:var(--font-serif)] text-[15px] text-[var(--color-ink-plum)]">
                    {p.nickname.slice(0, 1)}
                  </span>
                )}
                {p.isDefault && (
                  <span
                    aria-label="默认档案"
                    className="absolute -right-0.5 -top-0.5 rounded-full bg-[var(--color-accent-plum)] px-1 text-[10px] leading-none text-white"
                  >
                    ⭐
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-[family-name:var(--font-serif)] text-sm tracking-ritual text-[var(--color-ink-plum)]">
                    {p.nickname}
                  </span>
                  {p.gender && (
                    <span className="text-[11px] text-[var(--color-ink-fade)]">
                      {GENDER_ICON[p.gender]}
                    </span>
                  )}
                </div>
                {ymStr && (
                  <span className="text-[11px] text-[var(--color-ink-fade)]">{ymStr}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {allowAddNew && (
        <Link
          href={addNewHref}
          className={cn(
            "block rounded-[10px] border border-dashed border-[var(--color-accent-lavender)]/50 py-2 text-center text-[12px]",
            "text-[var(--color-accent-plum)] hover:bg-[var(--color-accent-lavender)]/10",
          )}
        >
          + 添加新档案
        </Link>
      )}
    </GlassCard>
  );
}
