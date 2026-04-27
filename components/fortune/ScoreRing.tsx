interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  /** 中央副标题，默认 "今 日 综 合" */
  caption?: string;
  /** 是否显示 4 角 ✧ 装饰，默认 true */
  sparkles?: boolean;
}

/**
 * 大圆环总分（spec §1 Home / image2）
 *
 * - 渐变 stroke (淡紫粉 → 淡紫) + 浅水彩底
 * - 中央数字 + 副标题（默认 "今 日 综 合"）
 * - 圆环左上 / 右下 2 处 ✧ 装饰（design prompts 第 117 行）
 */
export function ScoreRing({
  score,
  size = 160,
  strokeWidth = 10,
  caption = "今 日 综 合",
  sparkles = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - ratio);
  const gradientId = "score-ring-gradient";

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      data-testid="score-ring"
    >
      {/* 内圈水彩晕染（仪式感底） */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: strokeWidth + 4,
          top: strokeWidth + 4,
          right: strokeWidth + 4,
          bottom: strokeWidth + 4,
          background:
            "radial-gradient(circle at 50% 60%, rgba(240,184,200,0.18) 0%, rgba(201,161,217,0.10) 50%, transparent 80%)",
          borderRadius: "50%",
          filter: "blur(2px)",
        }}
      />

      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F0B8C8" />
            <stop offset="100%" stopColor="#C9A1D9" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(196, 186, 221, 0.3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>

      {/* 4 角 ✧ — 仅左上 + 右下，spec 117 行 */}
      {sparkles && (
        <>
          <span
            aria-hidden
            className="absolute select-none text-[var(--color-accent-lavender)] opacity-70"
            style={{
              left: -2,
              top: -2,
              fontSize: Math.max(10, size * 0.08),
              lineHeight: 1,
            }}
          >
            ✧
          </span>
          <span
            aria-hidden
            className="absolute select-none text-[var(--color-accent-lavender)] opacity-70"
            style={{
              right: -2,
              bottom: -2,
              fontSize: Math.max(10, size * 0.08),
              lineHeight: 1,
            }}
          >
            ✧
          </span>
        </>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="num-mono font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]"
          style={{ fontSize: size * 0.32, lineHeight: 1 }}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          {caption}
        </span>
      </div>
    </div>
  );
}
