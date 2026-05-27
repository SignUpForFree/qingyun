/**
 * 梅花解读正文展示：去掉文首重复元数据（时间/事由/起卦方式由结果卡 UI 展示）
 */

const SECTION_ONE = /\*\*##\s*一、|##\s*一、测算溯源/;

/** 剥掉 AI 可能仍输出的文首标题与三行元数据 */
export function stripMeihuaReadingPreamble(text: string): string {
  let t = text.trimStart();
  if (!t) return t;

  // 单行挤在一起：# 测算结果解读 测算时间：… 起卦方式：… **## 一、
  const oneLine = t.match(
    /^#\s*测算结果解读[\s\S]*?(?=\*\*##\s*一、|##\s*一、测算溯源)/,
  );
  if (oneLine) {
    t = t.slice(oneLine[0].length).trimStart();
  }

  t = t.replace(/^#\s*测算结果解读\s*\n+/m, "");
  t = t.replace(/^测算时间：[^\n]*\n+/m, "");
  t = t.replace(/^测算事由：[^\n]*\n+/m, "");
  t = t.replace(/^起卦方式：[^\n]*\n+/m, "");

  // 仍卡在文首、第一节未到时先不展示（避免红框那段闪现）
  if (!SECTION_ONE.test(t) && /^#?\s*测算结果解读|^测算时间：|^测算事由：|^起卦方式：/m.test(t)) {
    return "";
  }

  return t.trimStart();
}
