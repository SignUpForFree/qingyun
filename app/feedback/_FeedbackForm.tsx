"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["建议", "缺陷", "内容偏离", "其他"] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * 反馈表单（client component）
 *
 * 提交到 /api/feedback。后端做限流 + 转邮件（lib/email）。
 * 提交成功 → 切到"已收到"态；失败 → toast 提示。
 */
export function FeedbackForm() {
  const [category, setCategory] = React.useState<Category>("建议");
  const [content, setContent] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setState("sending");
    setErrMsg(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          content: content.trim(),
          contact: contact.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "rate_limited") {
          setErrMsg("今天提交太多次啦，请明天再来 ✨");
        } else if (data.error === "validation") {
          setErrMsg("内容长度需要在 1-2000 字之间");
        } else {
          setErrMsg("提交失败，请稍后再试");
        }
        setState("error");
        return;
      }
      setState("ok");
      setContent("");
      setContact("");
    } catch {
      setErrMsg("网络异常，请重试");
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <div className="rounded-2xl border border-[var(--color-accent-lavender)]/30 bg-white/80 p-6 text-center">
        <p className="text-sm text-[var(--color-ink-plum)]">
          收到啦，我们会尽快看 🌙
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => setState("idle")}
        >
          再写一条
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-[var(--color-accent-lavender)]/30 bg-white/80 p-5"
    >
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs tracking-ritual transition ${
              category === c
                ? "bg-[var(--color-accent-plum)] text-white"
                : "bg-[var(--color-accent-lavender)]/20 text-[var(--color-ink-plum)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder="想说什么都可以，从功能、文案、bug 到内容偏离都欢迎写下来…"
        className="w-full rounded-lg border border-[var(--color-accent-lavender)]/40 bg-white p-3 text-sm leading-relaxed focus:border-[var(--color-accent-plum)] focus:outline-none"
      />
      <input
        type="text"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="邮箱 / 微信号（可选，方便我们回访你）"
        maxLength={120}
        className="w-full rounded-lg border border-[var(--color-accent-lavender)]/40 bg-white px-3 py-2 text-sm focus:border-[var(--color-accent-plum)] focus:outline-none"
      />
      {errMsg ? (
        <p className="text-xs text-rose-500">{errMsg}</p>
      ) : null}
      <Button
        type="submit"
        disabled={state === "sending" || !content.trim()}
        className="h-10 w-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] text-white hover:opacity-90"
      >
        {state === "sending" ? "提交中…" : "发送反馈"}
      </Button>
      <p className="text-center text-[10px] text-[var(--color-ink-fade)]">
        每用户每 24h 上限 5 条
      </p>
    </form>
  );
}
