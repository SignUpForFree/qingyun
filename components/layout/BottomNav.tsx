"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/su";

const TABS = [
  { href: "/", key: "home", label: "首页" },
  { href: "/chat", key: "chat", label: "对话" },
  { href: "/me", key: "me", label: "我的" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="glass sticky bottom-0 z-30 flex h-14 border-t border-[var(--color-accent-lavender)]/30">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-300 ease-out",
              active
                ? "text-[var(--color-accent-plum)]"
                : "text-[var(--color-ink-fade)] hover:text-[var(--color-ink-mist)]",
            )}
          >
            {active && (
              <span className="absolute -top-1.5">
                <Sparkle size={8} variant="diamond" />
              </span>
            )}
            <span className="text-[10px] tracking-ritual">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
