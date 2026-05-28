/** 快速解梦：用户点「我要解梦」后直接展示的输入引导（需求文档 §AI 解梦） */
export const DREAM_FAST_GUIDE_TEXT = [
  "请描述你的梦境内容（包含以下信息，描述越详细越精准）",
  "1、描述梦境中的画面和人 / 物 / 地点以及发生的故事",
  "2、在梦境里你是什么情绪感受，醒来后情绪有没有变化？",
  "3、最近的现实生活中，有没有类似的场景、情绪，或者让你在意的事情？",
  "4、该梦境是否有比较特别的，让你觉得奇怪或是印象深刻的？",
].join("\n");

export const DREAM_AWAITING_INPUT_META = {
  ui: "text" as const,
  dreamAwaitingInput: true,
};
