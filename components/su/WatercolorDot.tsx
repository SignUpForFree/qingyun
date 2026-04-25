import { cn } from "@/lib/utils";

const COLOR_MAP = {
  lavender: "rgba(201,161,217,0.5)",
  pink: "rgba(240,184,200,0.5)",
  blue: "rgba(164,184,232,0.5)",
  jade: "rgba(191,217,194,0.5)",
  apricot: "rgba(232,201,164,0.5)",
} as const;

export type WatercolorColor = keyof typeof COLOR_MAP;

interface WatercolorDotProps {
  color?: WatercolorColor;
  size?: number;
  className?: string;
  breathing?: boolean;
}

export function WatercolorDot({
  color = "lavender",
  size = 24,
  className,
  breathing = true,
}: WatercolorDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none inline-block rounded-full",
        breathing && "animate-[wcd_4s_ease-in-out_infinite]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: COLOR_MAP[color],
        filter: "blur(8px)",
      }}
    />
  );
}
