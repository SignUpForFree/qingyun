import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function AppHeader({ title, left, right, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "glass sticky top-0 z-30 flex items-center border-b border-[var(--color-accent-lavender)]/30 px-4",
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
