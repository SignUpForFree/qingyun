interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

/**
 * 大圆环总分（spec §1 Home）
 *
 * - 渐变 stroke (淡紫粉 → 淡紫)
 * - 中央数字 + "分"
 * - 进度按 score / 100
 */
export function ScoreRing({ score, size = 160, strokeWidth = 10 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - ratio);
  const gradientId = "score-ring-gradient";

  return (
    <div className="relative" style={{ width: size, height: size }}>
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="num-mono font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]"
          style={{ fontSize: size * 0.32, lineHeight: 1 }}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
          今 日 综 合
        </span>
      </div>
    </div>
  );
}
