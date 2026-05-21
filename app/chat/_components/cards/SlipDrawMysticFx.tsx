"use client";

import { cn } from "@/lib/utils";
import { SlipBeamFunnel } from "./SlipBeamFunnel";

const SLIP_EASE = "cubic-bezier(0.42, 0, 0.58, 1)";

export const MYSTIC_KEYFRAMES = `
@keyframes qy-mystic-ring-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes qy-mystic-ring-spin-rev {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}
@keyframes qy-mystic-burst {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
  28% { opacity: 0; }
  38% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  55% { opacity: 0.55; transform: translate(-50%, -50%) scale(1.45); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.85); }
}
@keyframes qy-mystic-sparkle {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
}
@keyframes qy-mystic-sparkle-drift {
  0% { opacity: 0; transform: translate(0, 0) scale(0.3); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.1); }
}
@keyframes qy-mystic-aura-pulse {
  0%, 100% { opacity: 0.4; filter: blur(8px); }
  50% { opacity: 0.95; filter: blur(12px); }
}
@keyframes qy-mystic-shimmer-sweep {
  0% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
  30% { opacity: 0.9; }
  100% { transform: translateX(220%) skewX(-12deg); opacity: 0; }
}
@keyframes qy-zoom-sacred-ring {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  100% { opacity: 0.75; transform: translate(-50%, -50%) scale(1.25); }
}
`;

/** 击出轨迹上的散落灵光 */
const TRAIL_SPARKLES: ReadonlyArray<{
  left: string;
  top: string;
  dx: string;
  dy: string;
  delay: number;
}> = [
  { left: "46%", top: "44%", dx: "-14px", dy: "24px", delay: 0.2 },
  { left: "54%", top: "46%", dx: "16px", dy: "26px", delay: 0.26 },
  { left: "48%", top: "52%", dx: "-8px", dy: "32px", delay: 0.32 },
  { left: "52%", top: "54%", dx: "10px", dy: "34px", delay: 0.36 },
  { left: "50%", top: "48%", dx: "0px", dy: "28px", delay: 0.24 },
];

export interface SlipDrawMysticFxProps {
  phase: "pull" | "zoom";
  pullMs: number;
  zoomMs: number;
  className?: string;
}

/**
 * 抽签玄幻神光层：仙术漏斗光束 + 法阵 + 击出粒子
 */
export function SlipDrawMysticFx({
  phase,
  pullMs,
  zoomMs,
  className,
}: SlipDrawMysticFxProps) {
  const activeMs = phase === "pull" ? pullMs : zoomMs;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-[3] overflow-hidden", className)}
      aria-hidden
      data-testid="slip-mystic-fx"
    >
      <style>{MYSTIC_KEYFRAMES}</style>

      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(232,212,248,0.45) 0%, transparent 65%)",
        }}
      />

      {phase === "pull" && (
        <>
          {/* 仙术漏斗攻击光束（主视觉） */}
          <SlipBeamFunnel pullMs={pullMs} originTop="38%" />

          {/* 胸前法阵（凝聚点） */}
          <div
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 72,
              height: 72,
              background:
                "conic-gradient(from 0deg, transparent, rgba(201,161,217,0.5) 50deg, transparent 110deg, rgba(240,184,200,0.45) 180deg, transparent)",
              mask: "radial-gradient(circle, transparent 58%, black 59%, black 68%, transparent 69%)",
              WebkitMask:
                "radial-gradient(circle, transparent 58%, black 59%, black 68%, transparent 69%)",
              animation: `qy-mystic-ring-spin ${activeMs * 1.4}ms linear infinite`,
              opacity: 0.75,
            }}
          />

          {/* 击出原点爆发 */}
          <div
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 64,
              height: 64,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(201,161,217,0.4) 50%, transparent 72%)",
              animation: `qy-mystic-burst ${activeMs}ms ${SLIP_EASE} infinite`,
            }}
          />

          {/* 光束轨迹散落灵光 */}
          {TRAIL_SPARKLES.map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: s.left,
                top: s.top,
                width: 4,
                height: 4,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(201,161,217,0.8) 50%, transparent 100%)",
                boxShadow: "0 0 8px rgba(201,161,217,0.8)",
                ["--dx" as string]: s.dx,
                ["--dy" as string]: s.dy,
                animation: `qy-mystic-sparkle-drift ${activeMs * 0.85}ms ${SLIP_EASE} infinite`,
                animationDelay: `${s.delay * activeMs}ms`,
              }}
            />
          ))}
        </>
      )}

      {phase === "zoom" && (
        <>
          <div
            className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "conic-gradient(from 90deg, transparent, rgba(201,161,217,0.4) 60deg, transparent 120deg, rgba(240,184,200,0.35) 200deg, transparent)",
              mask: "radial-gradient(circle, transparent 55%, black 56%, black 75%, transparent 76%)",
              WebkitMask:
                "radial-gradient(circle, transparent 55%, black 56%, black 75%, transparent 76%)",
              animation: `qy-mystic-ring-spin ${zoomMs * 1.2}ms linear infinite`,
              opacity: 0.65,
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 200,
              height: 200,
              border: "1px solid rgba(201,161,217,0.35)",
              boxShadow:
                "0 0 40px rgba(201,161,217,0.45), 0 0 80px rgba(240,184,200,0.2)",
              animation: `qy-zoom-sacred-ring ${zoomMs}ms ${SLIP_EASE} forwards`,
            }}
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              animation: `qy-mystic-shimmer-sweep ${zoomMs * 0.9}ms ${SLIP_EASE} infinite`,
            }}
          >
            <div
              className="absolute top-1/2 left-0 h-32 w-24 -translate-y-1/2 opacity-70"
              style={{
                background:
                  "linear-gradient(105deg, transparent 0%, rgba(255,252,255,0.55) 45%, transparent 100%)",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** 签条本体灵光包裹（跟随 slip 容器） */
export function SlipHolyAura({ active, pullMs }: { active: boolean; pullMs: number }) {
  if (!active) return null;
  return (
    <>
      <style>{MYSTIC_KEYFRAMES}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 z-[-1] rounded-lg"
        style={{
          background:
            "radial-gradient(ellipse 80% 90% at 50% 20%, rgba(255,255,255,0.55) 0%, rgba(201,161,217,0.4) 35%, transparent 72%)",
          animation: `qy-mystic-aura-pulse ${pullMs * 0.8}ms ease-in-out infinite`,
        }}
        data-testid="slip-holy-aura"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
      >
        <div
          className="absolute inset-y-0 w-1/3"
          style={{
            background:
              "linear-gradient(105deg, transparent, rgba(255,255,255,0.5), transparent)",
            animation: `qy-mystic-shimmer-sweep ${pullMs * 1.1}ms ease-in-out infinite`,
          }}
        />
      </div>
    </>
  );
}
