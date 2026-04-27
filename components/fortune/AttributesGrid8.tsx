import type { Attributes } from "@/lib/fortune/attributes";

interface AttributesGrid8Props {
  attrs: Partial<Attributes>;
}

interface Item {
  label: string;
  value: string;
  /** hex color → 应用 textShadow 仪式感（仅幸运色 cell） */
  tone?: string;
}

/**
 * 8 幸运属性 grid (M4.2, image2)
 *
 * 4×2 grid：幸运色 / 幸运方位 / 幸运时辰 / 幸运数 / 幸运花 / 随身物 / 配饰 / 食物
 * 每个 cell 上 label 下 value，幸运色 hex 转 textShadow 给一点光晕。
 */
export function AttributesGrid8({ attrs }: AttributesGrid8Props) {
  const items: Item[] = [
    { label: "幸运色", value: attrs.color?.name ?? "—", tone: attrs.color?.hex },
    { label: "幸运方位", value: attrs.direction ?? "—" },
    { label: "幸运时辰", value: attrs.hour?.range ?? "—" },
    { label: "幸运数", value: attrs.number != null ? String(attrs.number) : "—" },
    { label: "幸运花", value: attrs.flower ?? "—" },
    { label: "随身物", value: attrs.item ?? "—" },
    { label: "配饰", value: attrs.accessory ?? "—" },
    { label: "食物", value: attrs.food ?? "—" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3" data-testid="attributes-grid-8">
      {items.map((it) => (
        <div key={it.label} className="text-center">
          <p className="text-[10px] tracking-ritual text-[var(--color-ink-fade)]">{it.label}</p>
          <p
            className="mt-1 font-[family-name:var(--font-serif)] text-[12px] leading-tight text-[var(--color-ink-plum)]"
            style={it.tone ? { textShadow: `0 0 8px ${it.tone}88` } : undefined}
            data-testid={`attr-${it.label}`}
          >
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}
