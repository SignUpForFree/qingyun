import { Sparkle } from "./Sparkle";

export function Divider() {
  return (
    <div className="my-4 flex items-center gap-2 opacity-60">
      <span className="h-[0.5px] flex-1 bg-gradient-to-r from-transparent via-[var(--color-accent-lavender)]/50 to-transparent" />
      <Sparkle size={10} variant="diamond" />
      <span className="h-[0.5px] flex-1 bg-gradient-to-r from-transparent via-[var(--color-accent-lavender)]/50 to-transparent" />
    </div>
  );
}
