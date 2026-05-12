"use client";

import { BottomNav } from "./BottomNav";
import { usePathname } from "next/navigation";

interface AppShellProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

function shouldHideNav(pathname: string): boolean {
  const prefixes = ["/onboarding", "/fortune", "/feedback"];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideNav = shouldHideNav(pathname);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main
        className="flex min-h-0 flex-1 flex-col"
        style={!hideNav ? { paddingBottom: "calc(52px + env(safe-area-inset-bottom, 0px))" } : undefined}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
