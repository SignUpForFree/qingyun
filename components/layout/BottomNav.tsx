"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TabItem {
  href: string;
  key: string;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabItem[] = [
  { href: "/", key: "home", label: "首页", Icon: House },
  { href: "/chat", key: "chat", label: "AI问答", Icon: MessageCircle },
  { href: "/me", key: "me", label: "我的", Icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// 这些路径下隐藏底栏：
//   - /chat /chat/*：底部 sticky 输入栏与底栏重叠，且需要更大对话区
//   - /onboarding：多步建档专心填表
//   - /fortune/*：单页详情滑屏
//   - /feedback：表单页
const HIDE_NAV_PREFIXES = ["/onboarding", "/fortune", "/feedback"];

function shouldHideNav(pathname: string) {
  return HIDE_NAV_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

const ACTIVE_COLOR = "#C870A0";
const INACTIVE_COLOR = "#8A80A0";

export function BottomNav() {
  const pathname = usePathname();
  if (shouldHideNav(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(230, 220, 245, 0.4)",
        borderRadius: "24px 24px 0 0",
        boxShadow: "0 -2px 16px rgba(200, 140, 200, 0.08)",
        // Home 指示条安全区
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className="flex items-center justify-around"
        style={{ height: "52px" }}
      >
        {TABS.map(({ key, label, Icon, href }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={key}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5"
              style={{
                width: "60px",
                height: "44px",
              }}
            >
              <Icon
                size={22}
                style={{ color: active ? ACTIVE_COLOR : INACTIVE_COLOR }}
              />
              <span
                style={{
                  fontSize: "10px",
                  color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
