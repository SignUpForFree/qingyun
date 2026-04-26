/**
 * 敏感词 / 高危内容前置过滤（spec §6.5 必做项）
 *
 * 仅 MVP 简化版：
 *   - 命中 hard list → 直接拒绝（404 / 400 / 友好提示）
 *   - 命中 soft list → 让 AI 知道用户在敏感话题上，prompt 自带温柔回避
 *
 * V1.1 接入正式审核 API（如阿里云内容安全）后整块替换。
 */

const HARD_DENY = [
  // 政治 / 法律高压线
  "习近平",
  "毛泽东",
  "六四",
  "天安门",
  "法轮功",
  // 极端违法
  "卖淫",
  "嫖娼",
  "毒品",
  "枪支",
  "炸弹",
  "贩毒",
] as const;

const SOFT_FLAG = [
  // 自伤 / 高危情绪
  "自杀",
  "想死",
  "活不下去",
  "不想活",
  // 高危情境
  "杀人",
  "杀了",
] as const;

export type SafetyLevel = "ok" | "soft" | "hard";

export interface SafetyResult {
  level: SafetyLevel;
  matched: string[];
  message: string;
}

/**
 * 检测一段文本的敏感等级
 *
 * - level='hard'  → 直接拒绝并显示 message
 * - level='soft'  → 允许放行但 message 提示用户专业资源（路由可决定是否插入安抚 system prompt）
 * - level='ok'    → 通过
 *
 * 注意 trim + lowercase 但不做 unicode normalize（中文敏感词都是双字以上，
 * 暴力 includes 已够 MVP）
 */
export function classifySafety(text: string): SafetyResult {
  const t = text.trim();
  if (!t) {
    return { level: "ok", matched: [], message: "" };
  }

  const hard = HARD_DENY.filter((w) => t.includes(w));
  if (hard.length > 0) {
    return {
      level: "hard",
      matched: hard,
      message: "这个话题暂时聊不了。如有困扰可以换个角度问问。",
    };
  }

  const soft = SOFT_FLAG.filter((w) => t.includes(w));
  if (soft.length > 0) {
    return {
      level: "soft",
      matched: soft,
      message:
        "如果你正经历低谷，请记得：北京心理援助热线 010-82951332，或 24 小时希望热线 400-161-9995。我也愿意陪你聊聊，但这些专业资源能帮你更多。",
    };
  }

  return { level: "ok", matched: [], message: "" };
}
