"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SlipPlaceholderShell } from "./SlipPlaceholderShell";
import { SlipDrawMysticFx, SlipHolyAura } from "./SlipDrawMysticFx";
import { SLIP_STAGE_BG } from "./slip-mist-styles";

const AVATAR_SRC = "/images/ai-avatar.png";
const SLIP_EASE = "cubic-bezier(0.42, 0, 0.58, 1)";

/** pull 结束态须与 zoom-shell 起始态一致，避免切阶段跳变 */
const PULL_END_Y = 48;
const PULL_END_SCALE = 0.44;

const KEYFRAMES = `
@keyframes qy-stage-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes qy-chest-glow-pulse {
  0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(0.9); }
  40% { opacity: 0.95; transform: translate(-50%, -50%) scale(1.08); }
  70% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
}
@keyframes qy-chest-ray {
  0% { opacity: 0; transform: translate(-50%, -50%) scaleY(0.3); }
  30% { opacity: 0.75; }
  100% { opacity: 0.35; transform: translate(-50%, -50%) scaleY(1); }
}
@keyframes qy-fairy-breathe {
  0%, 100% { transform: translate(-50%, 0) scale(1); }
  50% { transform: translate(-50%, -2px) scale(1.01); }
}
@keyframes qy-fairy-fade {
  to { opacity: 0; transform: translate(-50%, 0) scale(0.97); }
}
@keyframes qy-slip-pull-from-body {
  0% {
    opacity: 0;
    filter: drop-shadow(0 0 0 rgba(201,161,217,0));
    transform: translate(-50%, -50%) translateY(18px) scale(0.1) rotate(-2deg);
  }
  14% { opacity: 0.85; }
  32% {
    opacity: 1;
    filter: drop-shadow(0 0 16px rgba(255,248,255,0.9)) drop-shadow(0 0 28px rgba(201,161,217,0.75));
    transform: translate(-50%, -50%) translateY(8px) scale(0.22) rotate(0deg);
  }
  58% {
    filter: drop-shadow(0 0 12px rgba(240,184,200,0.7)) drop-shadow(0 0 22px rgba(201,161,217,0.6));
    transform: translate(-50%, -50%) translateY(28px) scale(0.34) rotate(1deg);
  }
  100% {
    opacity: 1;
    filter: drop-shadow(0 0 20px rgba(201,161,217,0.55));
    transform: translate(-50%, -50%) translateY(${PULL_END_Y}px) scale(${PULL_END_SCALE}) rotate(0deg);
  }
}
@keyframes qy-slip-zoom-to-center {
  0% {
    opacity: 1;
    top: 44%;
    transform: translate(-50%, -50%) translateY(${PULL_END_Y}px) scale(${PULL_END_SCALE});
  }
  100% {
    opacity: 1;
    top: 50%;
    transform: translate(-50%, -50%) translateY(0) scale(var(--qy-shell-end-scale, 0.9));
  }
}
@keyframes qy-slip-content-reveal {
  0% {
    opacity: 0;
    transform: scale(var(--qy-shell-end-scale, 0.9));
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes qy-zoom-halo {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
}
`;

export type SlipDrawAnimPhase = "pull" | "zoom";
export type SlipDrawZoomStep = "shell" | "reveal";

export interface SlipDrawAnimStageProps {
  phase: SlipDrawAnimPhase;
  zoomStep: SlipDrawZoomStep;
  pullMs: number;
  shellMs: number;
  revealMs: number;
  shellEndScale?: number;
  showContentReveal?: boolean;
  resolvedImageUrl?: string;
  imageAlt?: string;
  embedded?: boolean;
  className?: string;
}

/**
 * 抽签动效舞台：同一条灵签从胸前抽出 → 居中放大（雾紫签条）→ 再显真实签面
 */
export function SlipDrawAnimStage({
  phase,
  zoomStep,
  pullMs,
  shellMs,
  revealMs,
  shellEndScale = 0.9,
  showContentReveal = false,
  resolvedImageUrl,
  imageAlt = "灵签",
  embedded = false,
  className,
}: SlipDrawAnimStageProps) {
  const zoomMs = shellMs + revealMs;
  const statusText =
    phase === "pull"
      ? "仙女抽签中…"
      : zoomStep === "reveal" && !showContentReveal
        ? "福签显现中…"
        : phase === "zoom" && zoomStep === "shell"
          ? "灵签渐显…"
          : null;

  const slipAnimation =
    phase === "pull"
      ? `qy-slip-pull-from-body ${pullMs}ms ${SLIP_EASE} forwards`
      : zoomStep === "shell"
        ? `qy-slip-zoom-to-center ${shellMs}ms ${SLIP_EASE} forwards`
        : undefined;

  return (
    <div
      className={cn(
        "relative overflow-hidden px-4 py-5",
        embedded
          ? "rounded-none ring-0 shadow-none"
          : "rounded-[20px] ring-1 ring-[var(--color-accent-lavender)]/40",
        className,
      )}
      style={{ background: SLIP_STAGE_BG }}
      data-testid={phase === "zoom" ? "slip-zoom-stage" : "heavenly-slip-draw"}
    >
      <style>{KEYFRAMES}</style>

      <div
        className="relative mx-auto"
        style={{
          width: "100%",
          maxWidth: 280,
          minHeight: 320,
          animation: `qy-stage-in 0.35s ${SLIP_EASE} forwards`,
        }}
        data-testid="slip-draw-unified-stage"
      >
        <SlipDrawMysticFx phase={phase} pullMs={pullMs} zoomMs={zoomMs} />

        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
          style={{
            background:
              "radial-gradient(circle, rgba(201,161,217,0.32) 0%, transparent 72%)",
            animation:
              phase === "zoom"
                ? `qy-zoom-halo ${zoomMs}ms ${SLIP_EASE} forwards`
                : undefined,
          }}
        />

        {/* 福小运仙女 */}
        <div
          className={cn(
            "relative z-[1] mx-auto transition-opacity duration-500",
            phase === "zoom" && "pointer-events-none opacity-0",
          )}
          style={{
            width: 200,
            height: 200,
            animation:
              phase === "zoom"
                ? `qy-fairy-fade 0.5s ${SLIP_EASE} forwards`
                : undefined,
          }}
          data-testid="fairy-draw-stage"
        >
          <div
            className="absolute left-1/2 top-0"
            style={{
              animation:
                phase === "pull"
                  ? `qy-fairy-breathe ${pullMs}ms ${SLIP_EASE} infinite`
                  : undefined,
            }}
          >
            {phase === "pull" && (
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[58%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,252,255,0.35) 0%, rgba(201,161,217,0.25) 40%, transparent 70%)",
                  boxShadow: "0 0 32px rgba(240,184,200,0.4)",
                }}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AVATAR_SRC}
              alt=""
              width={128}
              height={128}
              className="relative z-[1] h-[128px] w-[128px] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_0_28px_rgba(255,248,255,0.45)] drop-shadow-[0_8px_24px_rgba(201,161,217,0.5)]"
              data-testid="fairy-avatar"
            />
          </div>

          {phase === "pull" && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 z-[2] h-14 w-14 rounded-full"
                style={{
                  top: "38%",
                  background:
                    "radial-gradient(circle, rgba(240,184,200,0.55) 0%, rgba(201,161,217,0.25) 55%, transparent 72%)",
                  animation: `qy-chest-glow-pulse ${pullMs}ms ${SLIP_EASE} infinite`,
                  transform: "translate(-50%, -50%)",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 z-[2] w-px"
                style={{
                  top: "34%",
                  height: 56,
                  background:
                    "linear-gradient(180deg, transparent, rgba(201,161,217,0.65), transparent)",
                  animation: `qy-chest-ray ${pullMs}ms ${SLIP_EASE} forwards`,
                  transform: "translateX(-50%)",
                }}
              />
            </>
          )}
        </div>

        {/* 同一条灵签：pull → zoom 连续动画（仅 transform / top，避免切阶段跳变） */}
        <div
          className="absolute left-1/2 z-[4] w-[54%] max-w-[220px]"
          style={{
            top: phase === "pull" ? "44%" : undefined,
            willChange: "transform, opacity, top",
            animation: slipAnimation,
            ["--qy-shell-end-scale" as string]: String(shellEndScale),
          }}
          data-testid="slip-from-body"
        >
          <SlipHolyAura active={phase === "pull"} pullMs={pullMs} />
          <div
            className={cn(
              "relative",
              phase === "zoom" && zoomStep === "reveal" && showContentReveal && "opacity-0",
            )}
            data-testid="slip-center-zoom"
          >
            <SlipPlaceholderShell
              size="md"
              className="!mx-0 !w-full !max-w-none !min-h-[180px]"
            />
          </div>
        </div>

        {phase === "zoom" && showContentReveal && resolvedImageUrl && (
          <div
            className="absolute inset-0 z-[5] flex items-center justify-center px-2 [animation:qy-slip-content-reveal_forwards]"
            style={{
              animationDuration: `${revealMs}ms`,
              animationTimingFunction: SLIP_EASE,
              transformOrigin: "center center",
              ["--qy-shell-end-scale" as string]: String(shellEndScale),
            }}
            data-testid="slip-content-reveal"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageUrl}
              alt={imageAlt}
              className="w-[88%] max-w-[280px] rounded-[20px] object-contain shadow-[0_12px_40px_rgba(201,161,217,0.35)] ring-1 ring-[var(--color-accent-lavender)]/45"
            />
          </div>
        )}
      </div>

      {statusText && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-center text-sm tracking-[0.12em] text-[var(--color-ink-plum)]"
        >
          {statusText}
        </p>
      )}
    </div>
  );
}
