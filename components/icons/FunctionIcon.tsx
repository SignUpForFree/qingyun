/**
 * 功能 SVG 图标库（M4.27）
 *
 * 自画 18 个 icon，零外部资源（不依赖 lucide-react）：
 *   - 4 launcher：divination / dream / bazi / meihua
 *   - 7 home dim：爱情 / 财富 / 事业 / 学习 / 健康 / 人际 / 心情
 *   - 6 抽签 dim：综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康
 *   - 1 generic：placeholder
 *
 * 设计：viewBox 24×24，stroke=currentColor，stroke-width 1.5，圆角端点，
 * 让调用方通过 className 控制颜色与尺寸（保持与素笺骨架一致）。
 *
 * 命名固定为 FunctionIconName 联合类型，便于上层映射。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type FunctionIconName =
  // launcher
  | "divination"
  | "dream"
  | "bazi"
  | "meihua"
  // home dim
  | "love"
  | "wealth"
  | "career"
  | "study"
  | "health"
  | "social"
  | "mood"
  // 抽签 dim
  | "overall"
  | "career-study"
  | "fortune"
  | "romance"
  | "patron"
  | "safety"
  // generic
  | "generic";

export interface FunctionIconProps {
  name: FunctionIconName;
  className?: string;
  size?: number;
  /** 默认 currentColor，调用方可注 #xxx 覆盖 */
  stroke?: string;
}

const COMMON_PROPS = {
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.5,
};

/**
 * 主入口：根据 name 派发到对应 SVG path 集合。
 * 所有 icon 共用 24×24 viewBox 与统一 stroke 设置，保证视觉一致。
 */
export function FunctionIcon({
  name,
  className,
  size = 24,
  stroke = "currentColor",
}: FunctionIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke={stroke}
      data-testid={`fn-icon-${name}`}
      aria-hidden
      className={cn(className)}
      {...COMMON_PROPS}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/**
 * 18 个 icon path 集合。每个用 React.Fragment 包多个 SVG primitive，
 * 都不带 fill 让线条风格一致（避免实心填充破坏素笺骨架）。
 */
const ICON_PATHS: Record<FunctionIconName, React.ReactNode> = {
  // ============ 4 launcher ============

  // 抽签：竹签筒 + 一根伸出
  divination: (
    <>
      <path d="M6 8 L6 20 Q6 21.5 7.5 21.5 L16.5 21.5 Q18 21.5 18 20 L18 8" />
      <line x1="6" y1="11" x2="18" y2="11" />
      <line x1="14" y1="3" x2="14" y2="11" />
      <circle cx="14" cy="3.5" r="0.8" />
    </>
  ),

  // 解梦：弦月 + 三星
  dream: (
    <>
      <path d="M16 4 A8 8 0 1 0 16 20 A6 6 0 1 1 16 4 Z" />
      <circle cx="6" cy="6" r="0.6" />
      <circle cx="9" cy="3" r="0.5" />
      <circle cx="4" cy="11" r="0.5" />
    </>
  ),

  // 八字：四柱 4×2 排列
  bazi: (
    <>
      <rect x="3" y="5" width="3.5" height="14" rx="0.5" />
      <rect x="8" y="5" width="3.5" height="14" rx="0.5" />
      <rect x="13" y="5" width="3.5" height="14" rx="0.5" />
      <rect x="18" y="5" width="3.5" height="14" rx="0.5" />
      <line x1="3" y1="12" x2="21.5" y2="12" />
    </>
  ),

  // 梅花：5 瓣花
  meihua: (
    <>
      <circle cx="12" cy="6" r="2.2" />
      <circle cx="6.5" cy="10" r="2.2" />
      <circle cx="17.5" cy="10" r="2.2" />
      <circle cx="8.5" cy="17" r="2.2" />
      <circle cx="15.5" cy="17" r="2.2" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),

  // ============ 7 home dim ============

  // 爱情：心
  love: (
    <path d="M12 20 L4 12 Q1 8 5 5 Q9 3 12 7 Q15 3 19 5 Q23 8 20 12 Z" />
  ),

  // 财富：铜钱（圆方孔）
  wealth: (
    <>
      <circle cx="12" cy="12" r="8" />
      <rect x="9.5" y="9.5" width="5" height="5" />
    </>
  ),

  // 事业：公文包
  career: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="1.5" />
      <path d="M9 7 L9 4 Q9 3 10 3 L14 3 Q15 3 15 4 L15 7" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </>
  ),

  // 学习：开卷书
  study: (
    <>
      <path d="M3 5 L11 6.5 L11 20 L3 18.5 Z" />
      <path d="M21 5 L13 6.5 L13 20 L21 18.5 Z" />
    </>
  ),

  // 健康：医疗十字 + 圆
  health: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </>
  ),

  // 人际：双人剪影
  social: (
    <>
      <circle cx="9" cy="8" r="2.5" />
      <circle cx="16" cy="9" r="2" />
      <path d="M3 19 Q3 14 9 14 Q15 14 15 19" />
      <path d="M14 19 Q14 15 16 15 Q21 15 21 19" />
    </>
  ),

  // 心情：笑脸
  mood: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.6" />
      <circle cx="15" cy="10" r="0.6" />
      <path d="M8 14 Q12 17 16 14" />
    </>
  ),

  // ============ 6 抽签 dim ============

  // 综合运势：罗盘 4 向
  overall: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <line x1="12" y1="3.5" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="20.5" />
      <line x1="3.5" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="20.5" y2="12" />
    </>
  ),

  // 事业学业：书+笔
  "career-study": (
    <>
      <path d="M5 4 L17 4 L17 17 L5 17 L5 4 Z" />
      <line x1="5" y1="8" x2="17" y2="8" />
      <line x1="14" y1="14" x2="20" y2="20" />
      <path d="M19 19.5 L20.5 21 L21 19.5 L19 19.5 Z" />
    </>
  ),

  // 财运：元宝
  fortune: (
    <>
      <path d="M3 16 Q3 11 12 11 Q21 11 21 16 L18 19 L6 19 Z" />
      <path d="M9 11 L12 7 L15 11" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </>
  ),

  // 感情姻缘：双心交叠
  romance: (
    <>
      <path d="M9 18 L4 13 Q1 10 4.5 8 Q7.5 7 9 10 Q10.5 7 13.5 8 Q17 10 14 13 Z" />
      <path d="M15 19 L11 15 Q9 13 11 11 Q14 11 15 13 Q16 11 19 11 Q21 13 19 15 Z" />
    </>
  ),

  // 人际贵人：手相握
  patron: (
    <>
      <path d="M3 12 L9 12 L11 14 L13 14 L15 12 L21 12" />
      <path d="M5 9 L7 12 L5 15" />
      <path d="M19 9 L17 12 L19 15" />
    </>
  ),

  // 平安健康：盾
  safety: (
    <>
      <path d="M12 3 L4 6 L4 12 Q4 17 12 21 Q20 17 20 12 L20 6 Z" />
      <path d="M9 12 L11 14 L15 10" />
    </>
  ),

  // ============ generic ============

  // 通用：圆点（占位）
  generic: <circle cx="12" cy="12" r="6" />,
};

/** 18 个 name 全集，便于上层枚举或测试 */
export const ALL_FUNCTION_ICON_NAMES: ReadonlyArray<FunctionIconName> = [
  "divination",
  "dream",
  "bazi",
  "meihua",
  "love",
  "wealth",
  "career",
  "study",
  "health",
  "social",
  "mood",
  "overall",
  "career-study",
  "fortune",
  "romance",
  "patron",
  "safety",
  "generic",
];
