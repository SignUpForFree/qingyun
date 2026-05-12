import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  /** 实色背景（chat 等需要稳定背板、不要 glass 透出后面消息流的页面） */
  solid?: boolean;
}

export function AppHeader({ title, left, right, className, solid }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-b border-[var(--color-accent-lavender)]/30 px-3 sm:px-4",
        solid
          ? "bg-[var(--color-bg-paper)]"
          : "glass",
        className,
      )}
      style={{
        height: 52,
        // 刘海屏 / 状态栏安全区
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex min-w-0 items-center justify-start">{left}</div>
      <div
        className={cn(
          "max-w-[min(58vw,300px)] justify-self-center text-center text-[15px]",
          "font-[family-name:var(--font-serif)] tracking-ritual2",
          "text-[var(--color-ink-plum)]",
        )}
      >
        {title}
      </div>
      <div className="flex min-w-0 items-center justify-end">{right}</div>
    </header>
  );
}
