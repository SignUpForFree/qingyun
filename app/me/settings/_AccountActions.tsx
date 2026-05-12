"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/su";
import { Button } from "@/components/ui/button";

/**
 * 数据导出 + 账号注销入口（PIPL 合规）
 *
 * 设计：
 *   - 数据导出：fetch /api/me/account/export，blob 下载。失败提示但不阻塞
 *   - 注销账号：两步确认 — 第一次点开 modal，第二次必须输入 "DELETE" 才提交
 */
export function AccountActions() {
  const router = useRouter();
  const [exporting, setExporting] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/me/account/export", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        alert(`导出失败（${res.status}），请稍后再试`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m?.[1] ?? "qingyun-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("导出失败，请检查网络后重试");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/me/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(`注销失败：${data.error ?? res.status}`);
        return;
      }
      // 注销成功 → 回首页（cookie 已被服务端清掉）
      router.replace("/");
      router.refresh();
    } catch {
      setErrorMsg("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <GlassCard
        className="overflow-hidden p-0"
        data-testid="settings-account-actions"
      >
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex h-12 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[var(--color-accent-lavender)]/10 disabled:opacity-50"
        >
          <Download className="h-4 w-4 text-[var(--color-ink-mist)]" />
          <span className="flex-1 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-[var(--color-ink-plum)]">
            {exporting ? "正在打包数据…" : "数据导出（JSON）"}
          </span>
          <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)]" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDeleteOpen(true);
            setConfirmText("");
            setErrorMsg(null);
          }}
          className="flex h-12 w-full items-center gap-3 border-t border-[var(--color-accent-lavender)]/20 px-4 text-left transition-colors hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4 text-rose-500" />
          <span className="flex-1 font-[family-name:var(--font-serif)] text-[14px] tracking-ritual text-rose-500">
            注销账号
          </span>
          <ChevronRight className="h-4 w-4 text-[var(--color-ink-fade)]" />
        </button>
      </GlassCard>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-2xl">
            <h2 className="text-lg font-medium text-[var(--color-ink-plum)]">
              确认注销账号
            </h2>
            <p className="mt-2 text-sm text-[var(--color-ink-mist)]">
              注销后将永久删除你的：档案、对话记录、运势记录、绑定信息。此操作不可恢复。
              <br />
              请在下方输入 <span className="font-mono text-rose-500">DELETE</span> 以确认。
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              placeholder="输入 DELETE"
              className="mt-4 w-full rounded-lg border border-[var(--color-accent-lavender)]/40 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
            />
            {errorMsg ? (
              <p className="mt-2 text-xs text-rose-500">{errorMsg}</p>
            ) : null}
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteOpen(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button
                type="button"
                className="flex-1 bg-rose-500 text-white hover:bg-rose-600"
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || submitting}
              >
                {submitting ? "注销中…" : "确认注销"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
