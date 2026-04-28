"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard, Sparkle } from "@/components/su";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProfileCardItem {
  id: string;
  nickname: string;
  gender: "male" | "female" | "other";
  birth_date: string;
  birth_time: string;
  birth_calendar: "solar" | "lunar";
  birth_place: string;
  is_default: boolean;
  avatar_url: string | null;
}

interface ProfileCardListProps {
  profiles: ProfileCardItem[];
}

/**
 * /me/profiles 多档案卡片列表（A3 模型）
 *
 * 每卡：圆形头像 + 昵称（默认徽章）+ 出生信息 + 操作按钮（编辑 / 设为默认 / 删除）。
 * 默认档不可删除（已在 API 层拒，此处只隐藏按钮）。
 *
 * 操作走 /api/me/profiles/[id]：
 *   - PUT { is_default: true } → 设为默认
 *   - DELETE                    → 删除非默认档
 */
export function ProfileCardList({ profiles }: ProfileCardListProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function setAsDefault(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/me/profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `切换失败 (${res.status})`);
        return;
      }
      toast.success("已设为默认档案");
      router.refresh();
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setBusy(null);
    }
  }

  async function deleteProfile(id: string, nickname: string) {
    if (busy) return;
    if (!confirm(`确定删除档案「${nickname}」？相关八字 / 梅花记录会一并清除，对话历史保留。`)) {
      return;
    }
    setBusy(id);
    try {
      const res = await fetch(`/api/me/profiles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `删除失败 (${res.status})`);
        return;
      }
      toast.success("档案已删除");
      router.refresh();
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setBusy(null);
    }
  }

  if (profiles.length === 0) {
    return (
      <GlassCard className="p-6 text-center text-sm text-[var(--color-ink-fade)]">
        还没有档案。
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3" data-testid="profile-card-list">
      {profiles.map((p) => (
        <GlassCard
          key={p.id}
          className="space-y-3 p-4"
          data-testid={`profile-card-${p.id}`}
        >
          <div className="flex items-start gap-3">
            <Avatar nickname={p.nickname} url={p.avatar_url} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-serif)] text-[16px] tracking-ritual text-[var(--color-ink-plum)]">
                  {p.nickname}
                </span>
                {p.is_default && (
                  <span
                    className="rounded-full bg-[var(--color-accent-lavender)]/30 px-2 py-0.5 text-[10px] tracking-ritual text-[var(--color-ink-plum)]"
                    data-testid={`profile-default-badge-${p.id}`}
                  >
                    默认
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-ink-fade)]">
                {p.gender === "male" ? "男" : p.gender === "female" ? "女" : "—"} · {birthSummary(p)}
              </p>
              <p className="text-[11px] text-[var(--color-ink-mist)]">{p.birth_place}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-accent-lavender)]/15 pt-2">
            <Link
              href={`/me/profiles/${p.id}/edit`}
              className="text-[11px] text-[var(--color-accent-plum)] hover:opacity-80"
              data-testid={`profile-edit-${p.id}`}
            >
              编辑
            </Link>
            {!p.is_default && (
              <>
                <Sparkle size={6} variant="diamond" />
                <button
                  type="button"
                  onClick={() => setAsDefault(p.id)}
                  disabled={busy === p.id}
                  className={cn(
                    "text-[11px] text-[var(--color-accent-plum)] hover:opacity-80 disabled:opacity-40",
                  )}
                  data-testid={`profile-set-default-${p.id}`}
                >
                  设为默认
                </button>
                <Sparkle size={6} variant="diamond" />
                <button
                  type="button"
                  onClick={() => deleteProfile(p.id, p.nickname)}
                  disabled={busy === p.id}
                  className="text-[11px] text-[var(--color-ink-fade)] hover:text-red-400 disabled:opacity-40"
                  data-testid={`profile-delete-${p.id}`}
                >
                  删除
                </button>
              </>
            )}
          </div>
        </GlassCard>
      ))}

      <Link href="/me/profiles/new" className="block">
        <Button
          variant="outline"
          className="h-12 w-full rounded-[14px] border-[var(--color-accent-lavender)]/40 font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-accent-plum)]"
          data-testid="profile-new-cta"
        >
          + 新建一个档案
        </Button>
      </Link>
    </div>
  );
}

function Avatar({ nickname, url }: { nickname: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={nickname}
        className="h-12 w-12 rounded-full object-cover"
      />
    );
  }
  const initial = (nickname || "我").slice(0, 1);
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-lavender)]/30 font-[family-name:var(--font-serif)] text-[18px] text-[var(--color-ink-plum)]">
      {initial}
    </div>
  );
}

function birthSummary(p: ProfileCardItem): string {
  const calendar = p.birth_calendar === "lunar" ? "农历" : "公历";
  const time = p.birth_time === "12:00" ? "时辰未知" : p.birth_time;
  return `${calendar} ${p.birth_date} ${time}`;
}
