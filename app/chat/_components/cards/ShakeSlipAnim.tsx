"use client";
import * as React from "react";
import { GlassCard } from "@/components/su";
import { cn } from "@/lib/utils";

export interface ShakeSlipAnimProps {
  /** 动画总时长（ms），默认 3500 */
  durationMs?: number;
  /** 动画结束触发（用于驱动后续 SSE 卡片显示）*/
  onComplete?: () => void;
  /** 自定义文案 */
  label?: string;
  className?: string;
}

const DEFAULT_DURATION_MS = 3500;

type Phase = "shaking" | "falling" | "landed";

const KEYFRAMES = `
@keyframes qy-tube-rock {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(-10deg); }
  30% { transform: rotate(9deg); }
  45% { transform: rotate(-8deg); }
  60% { transform: rotate(7deg); }
  75% { transform: rotate(-5deg); }
  90% { transform: rotate(3deg); }
}
@keyframes qy-stick-rattle {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1.5px); }
  50% { transform: translateX(2px); }
  75% { transform: translateX(-1px); }
}
@keyframes qy-slip-eject {
  0% {
    opacity: 1;
    transform: translateY(0) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: translateY(-70px) rotate(-8deg);
  }
  60% {
    opacity: 1;
    transform: translateY(-50px) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: translateY(20px) rotate(-2deg);
  }
}
@keyframes qy-slip-settle {
  0% { transform: translateY(20px) rotate(-2deg); }
  40% { transform: translateY(-6px) rotate(1deg); }
  70% { transform: translateY(2px) rotate(-0.5deg); }
  100% { transform: translateY(0) rotate(0deg); }
}
@keyframes qy-glow-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
`;

/**
 * 摇签动画卡 — 签筒摇摆 → 签跳出 → 落地
 *
 * 三阶段：
 * 1. shaking (0 → 60%)  — 签筒左右摇摆，签棒随动
 * 2. falling (60% → 80%) — 一根签从筒口弹出
 * 3. landed  (80% → 100%) — 签落地稳定，显示提示
 */
export function ShakeSlipAnim({
  durationMs = DEFAULT_DURATION_MS,
  onComplete,
  label = "天意降临…",
  className,
}: ShakeSlipAnimProps) {
  const [phase, setPhase] = React.useState<Phase>("shaking");

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase("falling"), durationMs * 0.6);
    const t2 = setTimeout(() => setPhase("landed"), durationMs * 0.8);
    const t3 = setTimeout(() => onComplete?.(), durationMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [durationMs, onComplete]);

  const shaking = phase === "shaking";
  const showEjected = phase === "falling" || phase === "landed";

  return (
    <GlassCard className={cn("p-6", className)}>
      <style>{KEYFRAMES}</style>

      <div className="relative mx-auto flex h-44 w-32 flex-col items-center justify-end">
        {/* 签筒 */}
        <div
          className="relative"
          style={{
            animation: shaking ? `qy-tube-rock ${durationMs * 0.6}ms ease-in-out` : "none",
          }}
        >
          {/* 筒身 — 木纹渐变 */}
          <div
            className="relative h-28 w-20 rounded-b-[10px] rounded-t-[6px] border border-[#a87c5e]/50"
            style={{
              background:
                "linear-gradient(180deg, #c9a06c 0%, #b8894a 30%, #a67735 60%, #946828 100%), " +
                "repeating-linear-gradient(90deg, rgba(120,80,40,0.08) 0px, rgba(120,80,40,0.08) 2px, transparent 2px, transparent 8px)",
            }}
          >
            {/* 筒口椭圆 */}
            <div
              className="absolute -top-1 left-1/2 h-3 w-[72px] -translate-x-1/2 rounded-[50%] border border-[#a87c5e]/60"
              style={{ background: "linear-gradient(180deg, #d4b07a 0%, #b8894a 100%)" }}
            />

            {/* 签棒们 */}
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute left-1/2"
                style={{
                  width: "3px",
                  height: "32px",
                  borderRadius: "1.5px",
                  background: i === 2 ? "#e8c88a" : "#d4b07a",
                  transform: `translateX(${(i - 2) * 6 - 1.5}px) translateY(-24px)`,
                  animation: shaking
                    ? `qy-stick-rattle ${250 + i * 40}ms ease-in-out ${i * 50}ms infinite`
                    : "none",
                }}
              >
                {/* 签棒顶部红色标记 */}
                <div
                  className="absolute -top-[2px] left-1/2 h-[4px] w-[5px] -translate-x-1/2 rounded-[1px]"
                  style={{ background: i === 2 ? "#c44" : "#b55" }}
                />
              </div>
            ))}

            {/* 筒底装饰线 */}
            <div
              className="absolute bottom-2 left-2 right-2 h-[2px] rounded"
              style={{ background: "rgba(120,80,40,0.2)" }}
            />
          </div>
        </div>

        {/* 弹出的签 */}
        {showEjected && (
          <div
            className="absolute"
            style={{
              bottom: "60px",
              left: "50%",
              transform: "translateX(-50%)",
              animation:
                phase === "falling"
                  ? `qy-slip-eject ${durationMs * 0.2}ms ease-out forwards`
                  : `qy-slip-settle ${durationMs * 0.2}ms ease-out forwards`,
            }}
          >
            <div
              className="relative h-16 w-[5px] rounded-[2px]"
              style={{
                background: "linear-gradient(180deg, #e8c88a 0%, #d4b07a 100%)",
              }}
            >
              {/* 签顶红标 */}
              <div
                className="absolute -top-[3px] left-1/2 h-[6px] w-[8px] -translate-x-1/2 rounded-[2px]"
                style={{ background: "#c44" }}
              />
              {/* 签上小字 */}
              <span
                className="absolute top-2 left-1/2 -translate-x-1/2 text-[5px] font-bold"
                style={{ color: "#7d2f2f", writingMode: "vertical-rl" }}
              >
                签
              </span>
            </div>
          </div>
        )}

        {/* 落地后的光晕 */}
        {phase === "landed" && (
          <div
            className="absolute bottom-8 left-1/2 h-8 w-16 -translate-x-1/2 rounded-[50%]"
            style={{
              background: "radial-gradient(ellipse, rgba(168,51,51,0.15) 0%, transparent 70%)",
              animation: "qy-glow-pulse 1.2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* 文案 */}
      <p
        role="status"
        aria-live="polite"
        className="mt-4 text-center text-sm font-[family-name:var(--font-serif)] tracking-ritual text-[var(--color-ink-plum)]"
      >
        {shaking ? "摇签中…" : label}
      </p>
    </GlassCard>
  );
}
