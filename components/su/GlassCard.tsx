import { cn } from "@/lib/utils";

type GlassShadow = "glass" | "float" | "none";
type GlassRadius = "chip" | "card" | "surface";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  shadow?: GlassShadow;
  rounded?: GlassRadius;
}

const RADIUS_CLASS: Record<GlassRadius, string> = {
  chip: "rounded-[8px]",
  card: "rounded-[16px]",
  surface: "rounded-[32px]",
};

const SHADOW_CLASS: Record<GlassShadow, string> = {
  glass: "shadow-[0_8px_24px_rgba(200,170,220,0.15)]",
  float: "shadow-[0_20px_60px_rgba(200,170,220,0.25)]",
  none: "",
};

export function GlassCard({
  children,
  className,
  shadow = "glass",
  rounded = "card",
}: GlassCardProps) {
  return (
    <div className={cn("glass hairline", RADIUS_CLASS[rounded], SHADOW_CLASS[shadow], className)}>
      {children}
    </div>
  );
}
