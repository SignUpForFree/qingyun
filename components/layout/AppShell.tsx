import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

export function AppShell({ children, hideNav }: AppShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="flex flex-1 flex-col">{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
