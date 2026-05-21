"use client";

import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";
import type { SlipImageLevel } from "./SlipImageFullscreen";
import { SlipImageFullscreen } from "./SlipImageFullscreen";
import {
  SLIP_DRAW_ANIM_MS,
  SLIP_PULL_PHASE_MS,
} from "./HeavenlySlipDraw";
import { SlipDrawAnimStage } from "./SlipDrawAnimStage";
import type { SlipDrawRevealMeta } from "./meta-types";

/** 放大阶段：0→90% 仅签条样式；90%→100% 再显真实签面 */
const ZOOM_SHELL_END_SCALE = 0.9;
const ZOOM_SHELL_TIME_RATIO = 0.72;

const RESULT_KEYFRAMES = `
@keyframes qy-result-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

export interface SlipDrawRevealCardProps {
  meta: SlipDrawRevealMeta;
  busy?: boolean;
  onExplain?: () => void;
  onShare?: () => void;
}

type AnimPhase = "pull" | "zoom" | "done";
type ZoomStep = "shell" | "reveal";

/**
 * 抽签一体卡：胸前抽出 → 签条样式居中放大至 90% → 再展示签面内容
 */
export function SlipDrawRevealCard({
  meta,
  busy,
  onExplain,
  onShare,
}: SlipDrawRevealCardProps) {
  const durationMs = meta.durationMs ?? SLIP_DRAW_ANIM_MS;
  const pullMs = Math.min(SLIP_PULL_PHASE_MS, durationMs - 1200);
  const zoomMs = durationMs - pullMs;
  const shellMs = Math.round(zoomMs * ZOOM_SHELL_TIME_RATIO);
  const revealMs = zoomMs - shellMs;

  const resultReady = Boolean(
    meta.slipNumber && meta.title && meta.imageUrl && meta.poemLines?.length,
  );
  const skipAnim = meta.phase === "revealed" && resultReady;

  const [phase, setPhase] = React.useState<AnimPhase>(skipAnim ? "done" : "pull");
  const [zoomStep, setZoomStep] = React.useState<ZoomStep>("shell");

  const showResult = (phase === "done" || skipAnim) && resultReady;

  React.useEffect(() => {
    if (skipAnim) return;
    const tPull = setTimeout(() => {
      setPhase("zoom");
      setZoomStep("shell");
    }, pullMs);
    const tShellEnd = setTimeout(() => setZoomStep("reveal"), pullMs + shellMs);
    const tDone = setTimeout(() => setPhase("done"), durationMs);
    return () => {
      clearTimeout(tPull);
      clearTimeout(tShellEnd);
      clearTimeout(tDone);
    };
  }, [skipAnim, pullMs, shellMs, durationMs]);

  React.useEffect(() => {
    if (!resultReady || !meta.imageUrl) return;
    const img = new Image();
    img.src = meta.imageUrl;
  }, [resultReady, meta.imageUrl]);

  const resolvedImageUrl = React.useMemo(() => {
    const url = meta.imageUrl;
    if (!url) return "";
    if (url.includes("layout=")) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}layout=4`;
  }, [meta.imageUrl]);

  const animating = !skipAnim && !showResult;
  const animPhase: AnimPhase = phase === "done" ? "zoom" : phase;
  const showContentReveal =
    animPhase === "zoom" &&
    zoomStep === "reveal" &&
    resultReady &&
    Boolean(resolvedImageUrl);

  return (
    <GlassCard
      className="relative overflow-hidden p-0"
      data-testid="slip-draw-reveal"
    >
      <style>{RESULT_KEYFRAMES}</style>

      <div className={cn("relative", animating && "min-h-[360px]")}>
        {animating && (
          <SlipDrawAnimStage
            embedded
            phase={animPhase === "pull" ? "pull" : "zoom"}
            zoomStep={zoomStep}
            pullMs={pullMs}
            shellMs={shellMs}
            revealMs={revealMs}
            shellEndScale={ZOOM_SHELL_END_SCALE}
            showContentReveal={showContentReveal}
            resolvedImageUrl={resolvedImageUrl}
            imageAlt={
              meta.title
                ? `第 ${meta.slipNumber} 签 · ${meta.title}`
                : "灵签"
            }
          />
        )}

        {showResult && (
          <div className="relative z-[3] p-3 [animation:qy-result-in_0.45s_ease-out_forwards]">
            <SlipImageFullscreen
              slipNumber={meta.slipNumber!}
              level={(meta.level ?? "吉") as SlipImageLevel}
              title={meta.title!}
              poemLines={meta.poemLines!}
              imageUrl={meta.imageUrl!}
              category={meta.category}
              reading={meta.reading}
              onExplain={onExplain}
              onShare={onShare}
              busy={busy}
              className="!p-0 !shadow-none !ring-0"
            />
          </div>
        )}
      </div>
    </GlassCard>
  );
}
