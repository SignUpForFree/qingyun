"use client";

import { BottomNav } from "./BottomNav";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

function shouldHideNav(pathname: string): boolean {
  const prefixes = ["/onboarding", "/fortune", "/feedback", "/profile"];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isChatRoute(pathname: string): boolean {
  return pathname === "/chat" || pathname.startsWith("/chat/");
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideNav = shouldHideNav(pathname);
  const chatRoute = isChatRoute(pathname);

  return (
    <div
      className={
        chatRoute
          ? "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden"
          : "flex min-h-[100dvh] flex-col"
      }
    >
      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          chatRoute && "h-full overflow-hidden",
        )}
        style={
          !hideNav
            ? { paddingBottom: "calc(52px + env(safe-area-inset-bottom, 0px))" }
            : undefined
        }
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
