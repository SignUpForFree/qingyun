"use client";
import { DivinationReadingSection } from "@/components/divination/DivinationReadingSection";
import { MeihuaReadingMarkdown } from "@/components/divination/MeihuaReadingMarkdown";
import { GlassCard, Sparkle } from "@/components/su";
import { cn } from "@/lib/utils";

/** 三重维度解读 */
interface ThreeViews {
  zhouGong: string;
  freud: string;
  jung: string;
}

/** precise 模式结构化段落 */
interface DreamSections {
  empathy: string;
  threeViews: ThreeViews;
  coreMeaning: string;
  suggestions: string[];
  subconsciousMsg: string;
  conclusion: string;
}

interface DreamResultCardProps {
  mode: "fast" | "precise";
  aiText: string;
  /** 解读区流式输出中 */
  readingStreaming?: boolean;
  /** precise 模式结构化段落（可选，有则分段渲染，无则 fallback aiText） */
  sections?: DreamSections | null;
  className?: string;
}

/** 维度标签配置 */
const DIM_LABELS: { key: keyof ThreeViews; label: string; icon: string }[] = [
  { key: "zhouGong", label: "周公解梦 · 民俗意象", icon: "📜" },
  { key: "freud", label: "弗洛伊德 · 愿望满足", icon: "🔮" },
  { key: "jung", label: "荣格 · 集体无意识", icon: "🌀" },
];

/**
 * 解梦结果卡（V1.0 需求对齐）
 *
 * - fast：Markdown 渲染（**标题** / 列表 / 加粗）
 * - precise：结构化分段 + 段内 Markdown
 */
export function DreamResultCard({
  mode,
  aiText,
  readingStreaming = false,
  sections,
  className,
}: DreamResultCardProps) {
  if (mode === "fast" || !sections) {
    const hasText = aiText.trim().length > 0;
    return (
      <GlassCard className={cn("space-y-3 p-4", className)}>
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
              "border border-[var(--color-accent-lavender)]/40",
              mode === "fast"
                ? "bg-[var(--color-wuxing-water)]/20"
                : "bg-[var(--color-accent-lavender)]/30",
            )}
          >
            {mode === "fast" ? "快 速 解 梦" : "精 准 解 梦"}
          </span>
          <Sparkle size={10} variant="diamond" />
        </div>
        {hasText || readingStreaming ? (
          <DivinationReadingSection
            aiText={aiText}
            readingStreaming={readingStreaming}
            withDivider={false}
            thinkingLabel="正在解读梦境…"
          >
            {hasText ? <MeihuaReadingMarkdown text={aiText} className="text-sm" /> : null}
          </DivinationReadingSection>
        ) : null}
      </GlassCard>
    );
  }

  // precise 模式：结构化 6 段
  return (
    <GlassCard className={cn("space-y-4 p-4", className)}>
      {/* header */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]",
            "border border-[var(--color-accent-lavender)]/40",
            "bg-[var(--color-accent-lavender)]/30",
          )}
        >
          精 准 解 梦
        </span>
        <Sparkle size={10} variant="diamond" />
      </div>

      {/* 🌙 开篇共情 */}
      {sections.empathy && (
        <Section emoji="🌙" title="你的梦境深度解析">
          <MeihuaReadingMarkdown text={sections.empathy} className="text-sm" />
        </Section>
      )}

      {/* 🔮 三重维度专业解读 */}
      <Section emoji="🔮" title="三重维度专业解读">
        <div className="space-y-3">
          {DIM_LABELS.map(({ key, label, icon }) => {
            const text = sections.threeViews[key];
            if (!text) return null;
            return (
              <div key={key}>
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-lavender)]/15 px-2 py-0.5 text-[11px] tracking-ritual2 text-[var(--color-ink-plum)]">
                  {icon} {label}
                </span>
                <MeihuaReadingMarkdown text={text} className="mt-1 text-sm" />
              </div>
            );
          })}
        </div>
      </Section>

      {/* 📜 核心寓意 */}
      {sections.coreMeaning && (
        <Section emoji="📜" title="核心寓意与重要节点指引">
          <MeihuaReadingMarkdown text={sections.coreMeaning} className="text-sm" />
        </Section>
      )}

      {/* 💡 规避方案 */}
      {sections.suggestions.length > 0 && (
        <Section emoji="💡" title="可落地的规避方案">
          <ul className="space-y-1.5">
            {sections.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--color-ink-plum)]">
                <span className="mt-0.5 shrink-0 text-[var(--color-accent-lavender)]">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 💌 潜意识真心话 */}
      {sections.subconsciousMsg && (
        <Section emoji="💌" title="潜意识想对你说的真心话">
          <MeihuaReadingMarkdown text={sections.subconsciousMsg} className="text-sm" />
        </Section>
      )}

      {/* 🌷 结语 */}
      {sections.conclusion && (
        <Section emoji="🌷" title="结语">
          <MeihuaReadingMarkdown text={sections.conclusion} className="text-sm" />
        </Section>
      )}
    </GlassCard>
  );
}

/** 分段标题行 */
function Section({ emoji, title, children }: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm">{emoji}</span>
        <span className="text-[12px] font-medium tracking-ritual2 text-[var(--color-ink-plum)]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
