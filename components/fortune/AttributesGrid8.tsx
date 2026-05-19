import type { Attributes } from "@/lib/fortune/attributes";

interface AttributesGrid8Props {
  attrs: Partial<Attributes>;
}

interface Item {
  label: string;
  value: string;
  emoji: string;
  /** hex color → 应用 textShadow 仪式感（仅幸运色 cell） */
  tone?: string;
}

/**
 * 8 幸运属性 grid（参考"福小运"四象 + emoji）
 *
 * 4×2 grid。第一行：💄色 💎配饰 🕐时辰 🧭方位
 *           第二行：🔢数 🍜食物 🔮随身物 🌻花
 * 每个 cell 顶部 emoji + 中间 value + 底部 label，幸运色 hex 转 textShadow 给一点光晕。
 */
export function AttributesGrid8({ attrs }: AttributesGrid8Props) {
  const items: Item[] = [
    { emoji: "💄", label: "幸运色", value: attrs.color?.name ?? "—", tone: attrs.color?.hex },
    { emoji: "💎", label: "配饰", value: attrs.accessory ?? "—" },
    { emoji: "🕐", label: "幸运时辰", value: attrs.hour?.range ?? "—" },
    { emoji: "🧭", label: "幸运方位", value: attrs.direction ?? "—" },
    { emoji: "🔢", label: "幸运数", value: attrs.number != null ? String(attrs.number) : "—" },
    { emoji: "🍜", label: "幸运食物", value: attrs.food ?? "—" },
    { emoji: "🔮", label: "随身物", value: attrs.item ?? "—" },
    { emoji: "🌻", label: "幸运花", value: attrs.flower ?? "—" },
  ];

  return (
    <div
      className="grid auto-rows-fr grid-cols-4 gap-x-1 gap-y-4"
      data-testid="attributes-grid-8"
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="flex flex-col items-center px-0.5 text-center"
          title={it.value}
        >
          <span aria-hidden className="text-[20px] leading-none">
            {it.emoji}
          </span>
          <p
            className="mt-1.5 line-clamp-2 font-[family-name:var(--font-serif)] text-[11.5px] leading-tight text-[var(--color-ink-plum)]"
            style={it.tone ? { textShadow: `0 0 8px ${it.tone}88` } : undefined}
            data-testid={`attr-${it.label}`}
          >
            {compactValue(it.value)}
          </p>
          <p className="mt-auto pt-0.5 text-[10px] tracking-ritual text-[var(--color-ink-fade)]">
            {it.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * 把"主名（注释）"格式压成主名，避免在 80px 宽 cell 撑坏 layout。
 * 例："黑色食物（黑米、紫菜、黑豆）" → "黑色食物"
 *     "01:00-03:00"               → 不变（无括号）
 */
function compactValue(value: string): string {
  const idx = value.search(/[（(]/);
  if (idx > 0) return value.slice(0, idx).trim();
  return value;
}
