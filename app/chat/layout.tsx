/**
 * /chat 专属布局 — 强制视口高度
 *
 * AppShell 用 min-h-[100dvh] 让 main 跟内容撑大，整个页面靠 window 滚动。
 * 但 chat 页面 MessageList 内部已有 overflow-y-auto + scrollIntoView 智能贴底，
 * 必须让 main 严格等于视口高度，否则：
 *   - MessageList 因父高度无限制不会真触发滚动
 *   - 流式 setState 时 scrollIntoView 滚的是 window，看上去不置底
 *
 * 这一层 h-[100dvh] flex-col + min-h-0 给 ChatWindow 子树锚定高度。
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[100dvh] min-h-0 flex-col">{children}</div>;
}
