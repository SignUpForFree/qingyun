/**
 * /chat 专属布局 — 在 main flex-1 + min-h-0 链路上占满可用高度
 *
 * MessageList 用 overflow-y-auto + 底锚滚动；父级需 min-h-0 才能把剩余高度传给 flex 子项。
 * 与 BottomNav 同屏时不再使用 h-[100dvh]，避免总高度超出视口。
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  // 与 AppShell BottomNav 同屏时由 main flex-1 分配高度，避免 h-[100dvh] 把底栏挤出视口
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
