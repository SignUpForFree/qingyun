"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkle } from "@/components/su";

interface ConversationItem {
  id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
}

/**
 * 会话历史抽屉（spec §4 chat session 头部 hamburger）
 *
 * - 按需 fetch /api/conversations（打开时拉，不预加载）
 * - 按 last_message_at 倒序，未发过消息的用 created_at
 * - 点击一条会话 → /chat/<id>，关抽屉
 */
interface HistoryDrawerProps {
  /** 当前会话 id（高亮用，可选） */
  currentId?: string;
}

export function HistoryDrawer({ currentId }: HistoryDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<ConversationItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const remove = React.useCallback(
    async (id: string) => {
      if (deletingId) return;
      const target = items?.find((c) => c.id === id);
      const ok = confirm(
        `确定删除会话『${target?.title?.trim() || "未命名对话"}』？\n这将一并清掉里面的消息和占卜记录。`,
      );
      if (!ok) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          toast.error(`删除失败 (${res.status})${body ? "：" + body.slice(0, 80) : ""}`);
          return;
        }
        setItems((prev) => prev?.filter((c) => c.id !== id) ?? null);
        toast.success("已删除");
        if (currentId === id) {
          router.replace("/chat");
        }
      } catch (e) {
        toast.error(`网络异常：${e instanceof Error ? e.message : "请稍后再试"}`);
      } finally {
        setDeletingId(null);
      }
    },
    [items, currentId, deletingId, router],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as { conversations: ConversationItem[] };
      setItems(json.conversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && items === null && !loading) {
      void load();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        aria-label="历史会话"
        className="text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[80vw] max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-[family-name:var(--font-serif)] tracking-ritual2">
            历史 <Sparkle size={10} variant="diamond" />
          </SheetTitle>
          <SheetDescription className="text-xs text-[var(--color-ink-fade)]">
            按最近对话倒序，最多保留 50 条
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-2 overflow-y-auto">
          {loading && (
            <>
              <Skeleton className="h-12 w-full rounded-[8px]" />
              <Skeleton className="h-12 w-full rounded-[8px]" />
              <Skeleton className="h-12 w-full rounded-[8px]" />
            </>
          )}
          {error && (
            <div className="rounded-[8px] bg-white/40 p-3 text-xs text-[var(--color-ink-mist)]">
              加载失败：{error}
              <button
                type="button"
                onClick={() => void load()}
                className="ml-2 text-[var(--color-accent-plum)] underline"
              >
                重试
              </button>
            </div>
          )}
          {!loading && !error && items?.length === 0 && (
            <p className="px-1 text-xs text-[var(--color-ink-fade)]">
              还没有对话，去问点什么吧
            </p>
          )}
          {!loading &&
            !error &&
            items?.map((c) => {
              const isCurrent = c.id === currentId;
              const ts = c.last_message_at ?? c.created_at;
              const isDeleting = deletingId === c.id;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group relative flex items-start gap-2 rounded-[8px] px-3 py-2 transition-colors",
                    isCurrent
                      ? "bg-[var(--color-accent-lavender)]/30"
                      : "hover:bg-[var(--color-accent-lavender)]/10",
                    isDeleting && "opacity-50",
                  )}
                >
                  <Link
                    href={`/chat/${c.id}`}
                    onClick={() => setOpen(false)}
                    className="flex flex-1 min-w-0 items-start gap-2"
                  >
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-fade)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-ink-plum)]">
                        {c.title?.trim() || "(未命名对话)"}
                      </p>
                      <p className="text-[10px] text-[var(--color-ink-fade)]">
                        {formatRelative(ts)}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label="删除会话"
                    disabled={isDeleting}
                    onClick={() => void remove(c.id)}
                    className={cn(
                      "shrink-0 rounded-full p-1 opacity-0 transition-opacity",
                      "text-[var(--color-ink-fade)] hover:bg-white/40 hover:text-[var(--color-ink-plum)]",
                      "group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}
