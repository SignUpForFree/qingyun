import { GlassCard } from "@/components/su";
import { AttributesGrid8 } from "./AttributesGrid8";
import type { Attributes } from "@/lib/fortune/attributes";

interface LuckyAttrsCardProps {
  attrs: Partial<Attributes>;
}

export function LuckyAttrsCard({ attrs }: LuckyAttrsCardProps) {
  return (
    <GlassCard className="p-5" data-testid="lucky-attrs-card">
      <AttributesGrid8 attrs={attrs} />
    </GlassCard>
  );
}
