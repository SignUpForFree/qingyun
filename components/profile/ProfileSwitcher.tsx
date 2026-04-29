"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Check } from "lucide-react";
import { Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/util/api-fetch";

export interface ProfileSwitcherItem {
  id: string;
  nickname: string;
  is_default: boolean;
  birth_date: string;
  birth_calendar: "solar" | "lunar";
  avatar_url: string | null;
}

interface ProfileSwitcherProps {
  profiles: ProfileSwitcherItem[];
  className?: string;
  /** 切换默认档案后的回调（用于 page-level 状态刷新） */
  onSwitched?: () => void;
}

/**
 * ProfileSwitcher（顶部抽屉，A3 多档案体验入口）
 *
 * - 单档案：不渲染（无意义切换）
 * - 多档案：显示 "当前：xxx ▾" trigger，点击打开底部抽屉列出全部
 * - 选中非当前档案 → PUT /api/me/profiles/[id] is_default=true → toast + router.refresh()
 * - 抽屉底部 + 管理档案 链接到 /me/profiles
 *
 * 复用 ProfileCardList 的 PUT 协议（M4 profile chain 阶段已统一）。
 */
export function ProfileSwitcher({
  profiles,
  className,
  onSwitched,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const current = profiles.find((p) => p.is_default) ?? profiles[0];

  if (!current || profiles.length < 2) return null;

  async function pick(id: string) {
    if (busy) return;
    if (id === current?.id) {
      setOpen(false);
      return;
    }
    setBusy(id);
    try {
      const res = await apiFetch(`/api/me/profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `切换失败 (${res.status})`);
        return;
      }
      toast.success("已切到该档案");
      setOpen(false);
      onSwitched?.();
      router.refresh();
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[12px] tracking-ritual text-[var(--color-ink-plum)] shadow-[0_1px_4px_rgba(160,140,210,0.15)]",
          "border border-[var(--color-accent-lavender)]/30 backdrop-blur-sm",
          "transition-colors hover:bg-white/60",
          className,
        )}
        data-testid="profile-switcher-trigger"
      >
        <Sparkle size={8} variant="diamond" />
        <span className="font-[family-name:var(--font-serif)]">{current.nickname}</span>
        <ChevronDown className="h-3 w-3 text-[var(--color-ink-fade)]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
          onClick={() => setOpen(false)}
          data-testid="profile-switcher-backdrop"
        >
          <div
            className="w-full max-w-md rounded-t-[24px] bg-white/95 p-5 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
            data-testid="profile-switcher-sheet"
          >
            <div className="mb-4 flex items-center justify-center gap-2">
              <Sparkle size={9} variant="asterisk" />
              <h3 className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-plum)]">
                切 换 档 案
              </h3>
              <Sparkle size={9} variant="asterisk" />
            </div>
            <ul className="space-y-2">
              {profiles.map((p) => {
                const isCurrent = p.id === current.id;
                const calendar = p.birth_calendar === "lunar" ? "农历" : "公历";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => pick(p.id)}
                      disabled={busy === p.id}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition-colors",
                        isCurrent
                          ? "bg-[var(--color-accent-lavender)]/20"
                          : "bg-white/40 hover:bg-white/70",
                      )}
                      data-testid={`profile-switcher-item-${p.id}`}
                    >
                      <Avatar nickname={p.nickname} url={p.avatar_url} />
                      <div className="flex-1">
                        <p className="font-[family-name:var(--font-serif)] text-[14px] text-[var(--color-ink-plum)]">
                          {p.nickname}
                        </p>
                        <p className="text-[10px] text-[var(--color-ink-fade)]">
                          {calendar} {p.birth_date}
                        </p>
                      </div>
                      {isCurrent && (
                        <Check
                          className="h-4 w-4 text-[var(--color-accent-plum)]"
                          aria-label="当前默认"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/me/profiles"
              onClick={() => setOpen(false)}
              className="mt-3 block text-center text-[12px] text-[var(--color-accent-plum)] hover:opacity-80"
              data-testid="profile-switcher-manage"
            >
              + 管 理 档 案
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({ nickname, url }: { nickname: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={url} alt={nickname} className="h-9 w-9 rounded-full object-cover" />
    );
  }
  const initial = (nickname || "我").slice(0, 1);
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent-lavender)]/30 font-[family-name:var(--font-serif)] text-[14px] text-[var(--color-ink-plum)]">
      {initial}
    </div>
  );
}
