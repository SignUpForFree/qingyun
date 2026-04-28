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
        "sticky top-0 z-30 flex items-center border-b border-[var(--color-accent-lavender)]/30 px-4",
        solid
          ? "bg-[var(--color-bg-paper)]"
          : "glass",
        className,
      )}
      style={{ height: 52 }}
    >
      <div className="flex w-10 justify-start">{left}</div>
      <div
        className={cn(
          "flex-1 text-center text-[15px]",
          "font-[family-name:var(--font-serif)] tracking-ritual2",
          "text-[var(--color-ink-plum)]",
        )}
      >
        {title}
      </div>
      <div className="flex w-10 justify-end">{right}</div>
    </header>
  );
}
