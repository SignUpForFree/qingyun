"use client";

import { cn } from "@/lib/utils";

const SLIP_EASE = "cubic-bezier(0.22, 0.85, 0.32, 1)";

export const BEAM_FUNNEL_KEYFRAMES = `
@keyframes qy-beam-origin-charge {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.85); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  35% { opacity: 0.75; transform: translate(-50%, -50%) scale(1); }
}
@keyframes qy-funnel-volume {
  0% {
    opacity: 0;
    transform: translateX(-50%) scaleX(0.12) scaleY(0.06);
  }
  10% { opacity: 0.55; }
  22% { opacity: 0.95; transform: translateX(-50%) scaleX(0.35) scaleY(0.25); }
  100% {
    opacity: 0.75;
    transform: translateX(-50%) scaleX(1) scaleY(1);
  }
}
@keyframes qy-beam-strike-out {
  0% {
    opacity: 0.2;
    transform: scaleY(0.04);
  }
  14% {
    opacity: 0.75;
    transform: scaleY(0.18);
  }
  28% {
    opacity: 1;
    transform: scaleY(0.45);
  }
  100% {
    opacity: 0.92;
    transform: scaleY(1);
  }
}
@keyframes qy-beam-head-flash {
  0%, 20%, 100% { opacity: 0; transform: scale(0.5); }
  26% { opacity: 1; transform: scale(1.2); }
  38% { opacity: 0.35; transform: scale(1.6); }
}
@keyframes qy-funnel-follow-slip {
  0% { transform: translateX(-50%) translateY(0); }
  100% { transform: translateX(-50%) translateY(42px); }
}
`;

/** 漏斗光束：角度、宽度、击出延迟（ms） */
const FUNNEL_BEAMS: ReadonlyArray<{
  angle: number;
  width: number;
  delay: number;
  tone: "core" | "mid" | "edge";
}> = [
  { angle: -34, width: 2, delay: 0, tone: "edge" },
  { angle: -28, width: 3, delay: 18, tone: "edge" },
  { angle: -22, width: 4, delay: 32, tone: "mid" },
  { angle: -16, width: 5, delay: 44, tone: "mid" },
  { angle: -10, width: 6, delay: 52, tone: "mid" },
  { angle: -5, width: 8, delay: 58, tone: "core" },
  { angle: 0, width: 11, delay: 62, tone: "core" },
  { angle: 5, width: 8, delay: 58, tone: "core" },
  { angle: 10, width: 6, delay: 52, tone: "mid" },
  { angle: 16, width: 5, delay: 44, tone: "mid" },
  { angle: 22, width: 4, delay: 32, tone: "mid" },
  { angle: 28, width: 3, delay: 18, tone: "edge" },
  { angle: 34, width: 2, delay: 0, tone: "edge" },
];

const BEAM_GRADIENT: Record<(typeof FUNNEL_BEAMS)[number]["tone"], string> = {
  core:
    "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,248,255,0.95) 8%, rgba(232,212,248,0.85) 35%, rgba(201,161,217,0.45) 70%, transparent 100%)",
  mid:
    "linear-gradient(180deg, rgba(255,252,255,0.95) 0%, rgba(240,184,200,0.8) 25%, rgba(201,161,217,0.55) 60%, transparent 100%)",
  edge:
    "linear-gradient(180deg, rgba(240,184,200,0.9) 0%, rgba(201,161,217,0.65) 40%, transparent 100%)",
};

const BEAM_GLOW: Record<(typeof FUNNEL_BEAMS)[number]["tone"], string> = {
  core: "0 0 14px rgba(255,255,255,0.95), 0 0 28px rgba(201,161,217,0.75)",
  mid: "0 0 10px rgba(240,184,200,0.8), 0 0 20px rgba(201,161,217,0.5)",
  edge: "0 0 6px rgba(201,161,217,0.65)",
};

/** 光束击出长度（px），与签条抽出位移大致同向 */
const BEAM_LENGTH = 148;

export interface SlipBeamFunnelProps {
  pullMs: number;
  /** 击出原点：与胸前抽出点一致 */
  originTop?: string;
  className?: string;
}

/**
 * 仙术漏斗光束：多道光束从胸前一点呈漏斗状向前击出，伴随灵签抽出
 */
export function SlipBeamFunnel({
  pullMs,
  originTop = "38%",
  className,
}: SlipBeamFunnelProps) {
  return (
    <div
      className={cn("pointer-events-none absolute left-1/2 z-[2]", className)}
      style={{
        top: originTop,
        animation: `qy-funnel-follow-slip ${pullMs}ms ${SLIP_EASE} infinite`,
      }}
      data-testid="slip-beam-funnel"
      aria-hidden
    >
      <style>{BEAM_FUNNEL_KEYFRAMES}</style>

      {/* 击出原点：仙术凝聚点 */}
      <div
        className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, #fff 0%, rgba(255,248,255,0.9) 35%, rgba(201,161,217,0.5) 65%, transparent 100%)",
          boxShadow:
            "0 0 20px rgba(255,255,255,0.95), 0 0 36px rgba(201,161,217,0.8), 0 0 56px rgba(240,184,200,0.45)",
          animation: `qy-beam-origin-charge ${pullMs}ms ${SLIP_EASE} infinite`,
        }}
        data-testid="slip-beam-origin"
      />

      {/* 击出瞬间光爆 */}
      <div
        className="absolute left-1/2 top-0 h-10 w-10 -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%)",
          animation: `qy-beam-head-flash ${pullMs}ms ${SLIP_EASE} infinite`,
        }}
      />

      {/* 漏斗状体积光（雾紫半透明锥体） */}
      <div
        className="absolute left-1/2 top-0 h-[152px] w-[200px] opacity-0"
        style={{
          transformOrigin: "top center",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(232,212,248,0.4) 18%, rgba(201,161,217,0.28) 55%, transparent 100%)",
          clipPath: "polygon(50% 0%, 18% 100%, 82% 100%)",
          filter: "blur(6px)",
          animation: `qy-funnel-volume ${pullMs}ms ${SLIP_EASE} infinite`,
        }}
        data-testid="slip-beam-funnel-volume"
      />

      {/* 多道攻击光束 */}
      <div
        className="absolute left-1/2 top-0 h-[152px] w-[220px] -translate-x-1/2"
        style={{ transformOrigin: "top center" }}
      >
        {FUNNEL_BEAMS.map((beam) => (
          <div
            key={beam.angle}
            className="absolute left-1/2 top-0"
            style={{
              transformOrigin: "top center",
              transform: `translateX(-50%) rotate(${beam.angle}deg)`,
            }}
          >
            <div
              className="origin-top rounded-full"
              style={{
                width: beam.width,
                height: BEAM_LENGTH,
                background: BEAM_GRADIENT[beam.tone],
                boxShadow: BEAM_GLOW[beam.tone],
                transformOrigin: "top center",
                animation: `qy-beam-strike-out ${pullMs}ms ${SLIP_EASE} infinite`,
                animationDelay: `${beam.delay}ms`,
              }}
              data-testid={beam.angle === 0 ? "slip-beam-core" : undefined}
            />
          </div>
        ))}
      </div>

      {/* 中央主光束（更粗更亮） */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{ transformOrigin: "top center" }}
      >
        <div
          className="rounded-full"
          style={{
            width: 14,
            height: BEAM_LENGTH,
            background:
              "linear-gradient(180deg, #ffffff 0%, rgba(255,252,255,0.98) 12%, rgba(232,212,248,0.9) 40%, rgba(201,161,217,0.5) 75%, transparent 100%)",
            boxShadow:
              "0 0 18px rgba(255,255,255,1), 0 0 32px rgba(201,161,217,0.85), 0 0 48px rgba(240,184,200,0.4)",
            transformOrigin: "top center",
            animation: `qy-beam-strike-out ${pullMs}ms ${SLIP_EASE} infinite`,
            animationDelay: "48ms",
          }}
        />
      </div>
    </div>
  );
}
