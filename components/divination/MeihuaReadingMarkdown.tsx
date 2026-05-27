"use client";

import { normalizeHeadingLines } from "@/lib/meihua/markdown-headings";
import { cn } from "@/lib/utils";

export { normalizeHeadingLines };

/**
 * 梅花《测算结果解读》轻量 Markdown 渲染
 */
export function MeihuaReadingMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const normalized = normalizeHeadingLines(text);
  const blocks = normalized.split(/\n\n+/).filter((b) => b.trim().length > 0);
  return (
    <div
      className={cn(
        "space-y-4 text-[13px] leading-[1.85] text-[var(--color-ink-plum)]",
        className,
      )}
      data-testid="meihua-reading-markdown"
    >
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: string }) {
  const lines = block.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  if (isTableBlock(lines)) {
    return <TableBlock lines={lines} />;
  }

  if (lines.length === 1) {
    return <Line line={lines[0]!} />;
  }

  const allList = lines.every((l) => /^\s*-\s+/.test(l));
  if (allList) {
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {lines.map((l, i) => (
          <li key={i}>
            <Inline text={l.replace(/^\s*-\s+/, "")} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <Line key={i} line={l} />
      ))}
    </div>
  );
}

function isTableBlock(lines: string[]): boolean {
  const tabRows = lines.filter((l) => l.includes("\t")).length;
  if (tabRows >= 2) return true;
  return lines.some((l) => /^体卦（问卦者自身）/.test(l.trim()));
}

function TableBlock({ lines }: { lines: string[] }) {
  const rows = lines.map((l) => splitTableRow(l));
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-accent-lavender)]/25 bg-white/20">
      <table className="w-full min-w-[280px] border-collapse text-left text-[12px]">
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className={cn(
                i === 0 && "font-semibold text-[var(--color-ink-plum)]",
                i > 0 && "border-t border-[var(--color-accent-lavender)]/15",
              )}
            >
              {cells.map((cell, j) => (
                <td key={j} className="px-2.5 py-2 align-top">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function splitTableRow(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim());
  }
  return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
}

function Line({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const heading = parseHeadingLine(trimmed);
  if (heading) {
    return <Heading level={heading.level} title={heading.title} />;
  }

  if (isGuaSubhead(trimmed)) {
    return (
      <p className="font-[family-name:var(--font-serif)] text-[14px] font-semibold text-[var(--color-ink-plum)]">
        <Inline text={trimmed} />
      </p>
    );
  }

  if (/^\s*-\s+/.test(trimmed)) {
    return (
      <p>
        <Inline text={trimmed.replace(/^\s*-\s+/, "• ")} />
      </p>
    );
  }

  return (
    <p>
      <Inline text={trimmed} />
    </p>
  );
}

function isGuaSubhead(line: string): boolean {
  return /^(本卦|互卦|变卦)(\s*·|\s{2,})/.test(line);
}

function parseHeadingLine(trimmed: string): { level: 1 | 2 | 3; title: string } | null {
  const fullWrap = trimmed.match(/^\*\*(#{1,3}\s+.+?)\*\*$/);
  if (fullWrap) {
    return parseHashTitle(fullWrap[1]!);
  }

  const partialWrap = trimmed.match(/^\*\*(#{1,3}\s+[^*]+)\*\*(?:\s+(.+))?$/);
  if (partialWrap) {
    const base = parseHashTitle(partialWrap[1]!);
    if (!base) return null;
    const suffix = partialWrap[2]?.trim();
    return {
      level: base.level,
      title: suffix ? `${base.title} · ${suffix}` : base.title,
    };
  }

  const bare = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (bare) {
    const level = bare[1]!.length as 1 | 2 | 3;
    let title = bare[2]!.trim();
    title = title.replace(/：\s*$/, "");
    return { level, title };
  }

  return null;
}

function parseHashTitle(raw: string): { level: 1 | 2 | 3; title: string } | null {
  const m = raw.match(/^(#{1,3})\s+(.+)$/);
  if (!m) return null;
  let title = m[2]!.trim().replace(/：\s*$/, "");
  return { level: m[1]!.length as 1 | 2 | 3, title };
}

function Heading({ level, title }: { level: 1 | 2 | 3; title: string }) {
  const cls = "font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]";
  if (level === 1) {
    return (
      <h1 className={cn(cls, "text-[17px] font-bold tracking-ritual")}>{title}</h1>
    );
  }
  if (level === 2) {
    return (
      <h2 className={cn(cls, "text-[15px] font-bold tracking-ritual")}>{title}</h2>
    );
  }
  return <h3 className={cn(cls, "text-[14px] font-bold")}>{title}</h3>;
}

function Inline({ text }: { text: string }) {
  const stripped = text.replace(/^#{1,3}\s+/, "");
  const parts = stripped.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) {
          const inner = bold[1]!.replace(/^#{1,3}\s+/, "").replace(/：\s*$/, "");
          return (
            <strong key={i} className="font-semibold text-[var(--color-ink-plum)]">
              {inner}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
