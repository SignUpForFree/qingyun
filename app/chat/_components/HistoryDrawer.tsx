"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, MessageSquare, Search, X } from "lucide-react";
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

/**
 * V2.0 历史抽屉（M2.23, spec §4.6）
 *
 * - 数据源：/api/chat/conversations（M2.21）
 * - 搜索：/api/chat/conversations/search（M2.22，3+ 字才调）
 * - 分组：today / yesterday / 7days / older（server hint）
 * - 删除：DELETE /api/conversations/:id（V1.0 路径，仍兼容）
 * - 防御：搜索 debounce 300ms；空 q 回到列表态
 *
 * HistoryDrawerBody 是可独立 RTL 的内层（绕过 Sheet portal 在 jsdom 不渲染的限制）。
 */

type GroupKey = "today" | "yesterday" | "7days" | "older";

export interface ConversationItem {
  id: string;
  title: string;
  preview: string;
  lastIntent: string | null;
  lastMessageAt: string | null;
  group: GroupKey;
}

export interface SearchHit {
  id: string;
  title: string;
  lastMessageAt: string | null;
  snippet: string;
}

interface HistoryDrawerProps {
  /** 当前会话 id（高亮用，可选） */
  currentId?: string;
  /** 受控 open（可选；不传则内部 state） */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 隐藏触发按钮（M4.QA fix：避免 ChatWindow 内嵌 + AppHeader right 双 ☰ 重复） */
  hideTrigger?: boolean;
}

const GROUP_LABEL: Record<GroupKey, string> = {
  today: "今天",
  yesterday: "昨天",
  "7days": "7 天内",
  older: "更早",
};
const GROUP_ORDER: GroupKey[] = ["today", "yesterday", "7days", "older"];

export function HistoryDrawer({ currentId, open: controlledOpen, onOpenChange, hideTrigger }: HistoryDrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <SheetTrigger
          aria-label="历史会话"
          className="text-[var(--color-ink-mist)] hover:text-[var(--color-ink-plum)]"
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
      )}
      <SheetContent side="left" className="w-[80vw] max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-[family-name:var(--font-serif)] tracking-ritual2">
            历史 <Sparkle size={10} variant="diamond" />
          </SheetTitle>
          <SheetDescription className="text-xs text-[var(--color-ink-fade)]">
            按最近对话倒序，最多保留 50 条
          </SheetDescription>
        </SheetHeader>

        <HistoryDrawerBody
          open={open}
          currentId={currentId}
          onPickConversation={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

/**
 * 抽屉内层 — 数据/搜索/删除逻辑全在这里。可独立 RTL 测。
 */
export function HistoryDrawerBody({
  open,
  currentId,
  onPickConversation,
  fetchImpl,
}: {
  /** 受控开关：仅 open=true 时拉数据 */
  open: boolean;
  currentId?: string;
  /** 用户点击某条对话或新建时调用（关抽屉用） */
  onPickConversation: () => void;
  /** 测试可注入；默认全局 fetch */
  fetchImpl?: typeof fetch;
}) {
  const router = useRouter();
  const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);

  const [items, setItems] = React.useState<ConversationItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [searchHits, setSearchHits] = React.useState<SearchHit[] | null>(null);
  const [searching, setSearching] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await doFetch("/api/chat/conversations?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as { items: ConversationItem[] };
      setItems(json.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [doFetch]);

  React.useEffect(() => {
    if (open && items === null && !loading) {
      void load();
    }
  }, [open, items, loading, load]);

  // 搜索 debounce
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSearchHits(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await doFetch(
          `/api/chat/conversations/search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          setSearchHits([]);
          return;
        }
        const json = (await res.json()) as { items: SearchHit[] };
        setSearchHits(json.items);
      } catch {
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, doFetch]);

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
        const res = await doFetch(`/api/conversations/${id}`, { method: "DELETE" });
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
    [items, currentId, deletingId, router, doFetch],
  );

  const grouped = React.useMemo(() => {
    if (!items) return null;
    const map = new Map<GroupKey, ConversationItem[]>();
    for (const c of items) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return map;
  }, [items]);

  const showSearchResults = searchHits !== null;

  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onPickConversation();
            router.replace("/chat?t=" + Date.now());
          }}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--color-accent-lavender)]/40 bg-white/40 px-3 py-1.5 text-xs tracking-ritual2 text-[var(--color-ink-plum)] hover:bg-[var(--color-accent-lavender)]/20"
        >
          + 新对话
        </button>
      </div>

      <div className="mt-3 relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-fade)]" />
        <input
          type="search"
          placeholder="搜索（3 字以上）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-[8px] border border-[var(--color-accent-lavender)]/30 bg-white/60 py-1.5 pl-7 pr-3 text-xs text-[var(--color-ink-plum)] outline-none focus:border-[var(--color-accent-plum)]"
        />
      </div>

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

        {showSearchResults && (
          <SearchResults
            hits={searchHits}
            searching={searching}
            currentId={currentId}
            onPick={onPickConversation}
          />
        )}

        {!showSearchResults && !loading && !error && items?.length === 0 && (
          <p className="px-1 text-xs text-[var(--color-ink-fade)]">
            还没有对话，去问点什么吧
          </p>
        )}

        {!showSearchResults &&
          !loading &&
          !error &&
          grouped &&
          GROUP_ORDER.map((g) => {
            const arr = grouped.get(g);
            if (!arr || arr.length === 0) return null;
            return (
              <section key={g} className="flex flex-col gap-1.5">
                <h4 className="mt-1 px-1 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
                  {GROUP_LABEL[g]}
                </h4>
                {arr.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    isCurrent={c.id === currentId}
                    isDeleting={deletingId === c.id}
                    onPick={onPickConversation}
                    onDelete={() => void remove(c.id)}
                  />
                ))}
              </section>
            );
          })}
      </div>
    </>
  );
}

function ConversationRow({
  conversation,
  isCurrent,
  isDeleting,
  onPick,
  onDelete,
}: {
  conversation: ConversationItem;
  isCurrent: boolean;
  isDeleting: boolean;
  onPick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid={`conv-row-${conversation.id}`}
      className={cn(
        "group relative flex items-start gap-2 rounded-[8px] px-3 py-2 transition-colors",
        isCurrent
          ? "bg-[var(--color-accent-lavender)]/30"
          : "hover:bg-[var(--color-accent-lavender)]/10",
        isDeleting && "opacity-50",
      )}
    >
      <Link
        href={`/chat?cid=${conversation.id}`}
        onClick={onPick}
        className="flex flex-1 min-w-0 items-start gap-2"
      >
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-fade)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--color-ink-plum)]">
            {conversation.title?.trim() || "(未命名对话)"}
          </p>
          {conversation.preview && (
            <p className="truncate text-[10px] text-[var(--color-ink-fade)]">
              {conversation.preview}
            </p>
          )}
          <p className="text-[10px] text-[var(--color-ink-fade)]">
            {formatRelative(conversation.lastMessageAt)}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-label="删除会话"
        disabled={isDeleting}
        onClick={onDelete}
        className={cn(
          "shrink-0 rounded-full p-1 transition-opacity",
          "text-[var(--color-ink-fade)] hover:bg-white/40 hover:text-[var(--color-ink-plum)]",
          "opacity-60 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SearchResults({
  hits,
  searching,
  currentId,
  onPick,
}: {
  hits: SearchHit[] | null;
  searching: boolean;
  currentId: string | undefined;
  onPick: () => void;
}) {
  if (searching) {
    return (
      <>
        <Skeleton className="h-12 w-full rounded-[8px]" />
        <Skeleton className="h-12 w-full rounded-[8px]" />
      </>
    );
  }
  if (!hits || hits.length === 0) {
    return (
      <p className="px-1 text-xs text-[var(--color-ink-fade)]">没有匹配的对话</p>
    );
  }
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="mt-1 px-1 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
        搜索结果（{hits.length}）
      </h4>
      {hits.map((h) => (
        <Link
          key={h.id}
          href={`/chat?cid=${h.id}`}
          onClick={onPick}
          data-testid={`search-hit-${h.id}`}
          className={cn(
            "flex items-start gap-2 rounded-[8px] px-3 py-2 transition-colors",
            h.id === currentId
              ? "bg-[var(--color-accent-lavender)]/30"
              : "hover:bg-[var(--color-accent-lavender)]/10",
          )}
        >
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-fade)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--color-ink-plum)]">
              {h.title?.trim() || "(未命名对话)"}
            </p>
            <p
              className="truncate text-[11px] text-[var(--color-ink-mist)]"
              dangerouslySetInnerHTML={{ __html: h.snippet }}
            />
            <p className="text-[10px] text-[var(--color-ink-fade)]">
              {formatRelative(h.lastMessageAt)}
            </p>
          </div>
        </Link>
      ))}
    </section>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
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
