/** 把「**### 标题**  副标题」合并进标题行，避免 ### 落进正文 */
export function normalizeHeadingLines(text: string): string {
  return text.replace(
    /^\*\*(#{1,3}\s+[^*]+)\*\*\s+(.+)$/gm,
    (_, heading: string, suffix: string) => `**${heading} · ${suffix.trim()}**`,
  );
}
