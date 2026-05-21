"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SlipDrawAnimStage } from "./SlipDrawAnimStage";

export const SLIP_DRAW_ANIM_MS = 3000;
/** 从角色胸前抽出的阶段时长 */
export const SLIP_PULL_PHASE_MS = 1200;

export interface HeavenlySlipDrawProps {
  pullDurationMs?: number;
  durationMs?: number;
  onComplete?: () => void;
  fadingOut?: boolean;
  waitingLabel?: string;
  className?: string;
  embedded?: boolean;
}

/**
 * 阶段一：福小运仙女胸前抽出灵签（独立 slip_drawing 或嵌入一体卡 pull 段）
 */
export function HeavenlySlipDraw({
  pullDurationMs = SLIP_PULL_PHASE_MS,
  durationMs,
  onComplete,
  fadingOut = false,
  className,
  embedded = false,
}: HeavenlySlipDrawProps) {
  const pullMs = durationMs ?? pullDurationMs;
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    if (!onCompleteRef.current) return;
    const t = setTimeout(() => onCompleteRef.current?.(), pullMs);
    return () => clearTimeout(t);
  }, [pullMs]);

  return (
    <SlipDrawAnimStage
      phase={fadingOut ? "zoom" : "pull"}
      zoomStep="shell"
      pullMs={pullMs}
      shellMs={fadingOut ? 800 : 1}
      revealMs={1}
      embedded={embedded}
      className={cn(className)}
    />
  );
}
