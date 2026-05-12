"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ReadingSource } from "@/lib/fortune/fetch-today";

export type ReadingScope = "day" | "week" | "month";

interface ReadingAutoRegenProps {
  /** 当前 reading 来源（来自 fortunes_*.reading_source） */
  source: ReadingSource;
  /** 锚定日期（YYYY-MM-DD）— day = 当天，week = 周内任一天，month = 月内任一天 */
  date: string;
  /** 默认 day，向后兼容 */
  scope?: ReadingScope;
}

/**
 * Reading 后台 AI 升级组件 — 不渲染任何 UI
 *
 * 详见 docs/superpowers/specs/2026-05-04-fortune-reading-ai-mcp.md §3
 *
 * 行为：
 *   - source === "ai" → 直接 return，不动
 *   - source === "fallback" → mount 后一次性 POST /api/fortune/<scope>/regenerate
 *     - 后端 AI 成功 → router.refresh，第二次 RSC 渲染拿到 AI 个性化 reading
 *     - 后端 AI 失败 → 静默不刷新，保留 fallback 文案给用户
 *
 * 防御：
 *   - sessionStorage 标记位防止开发模式 StrictMode 双调（同 scope+date 1 个 session 只发一次）
 *   - in-flight ref 防止快速 mount/unmount 期间并发请求
 */
export function ReadingAutoRegen({
  source,
  date,
  scope = "day",
}: ReadingAutoRegenProps) {
  const router = useRouter();
  const inFlightRef = React.useRef(false);

  React.useEffect(() => {
    if (source === "ai") return;
    if (inFlightRef.current) return;

    const sessionKey = `qy:reading-regen:${scope}:${date}`;
    if (typeof window !== "undefined") {
      try {
        if (window.sessionStorage.getItem(sessionKey)) return;
        window.sessionStorage.setItem(sessionKey, "1");
      } catch {
        /* 隐私模式 / 限额满 → 跳过 storage 但仍发请求 */
      }
    }

    inFlightRef.current = true;
    const ac = new AbortController();

    const endpoint =
      scope === "day"
        ? "/api/fortune/today/regenerate"
        : scope === "week"
        ? "/api/fortune/weekly/regenerate"
        : "/api/fortune/monthly/regenerate";
    const body =
      scope === "day" ? { date } : { anchorDate: date };

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
      .then((res) => res.json())
      .then((data: { regenerated?: boolean; reason?: string }) => {
        if (data.regenerated) {
          router.refresh();
        } else if (process.env.NODE_ENV !== "production") {
          console.info("[ReadingAutoRegen] skip regenerate:", scope, data.reason);
        }
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ReadingAutoRegen] fetch failed", e);
        }
      })
      .finally(() => {
        inFlightRef.current = false;
      });

    return () => ac.abort();
  }, [date, scope, source, router]);

  return null;
}
