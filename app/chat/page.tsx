"use client";

import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { QuickActions } from "./_components/QuickActions";
import { ChatInput } from "./_components/ChatInput";

/**
 * /chat 招呼页（spec §3 Chat Welcome）
 *
 * - 顶 AppHeader "对话"
 * - GlassCard 招呼语 + 4 快捷入口 QuickActions
 * - 底部 ChatInput pill, 提交后跳到 /chat/new?initial=...
 */
export default function ChatHomePage() {
  const router = useRouter();
  return (
    <>
      <AppHeader title="对话" />
      <div className="flex flex-1 flex-col gap-5 p-4">
        <GlassCard className="space-y-2 p-5 text-center">
          <h2 className="text-lg tracking-ritual2">
            今天，想聊点什么 <Sparkle size={12} />
          </h2>
          <p className="text-xs text-[var(--color-ink-fade)]">
            可以问命盘、解个梦、抽支签，也可以只是闲聊
          </p>
        </GlassCard>

        <Divider />

        <QuickActions />
      </div>

      <ChatInput
        onSend={(text) => {
          router.push(`/chat/new?initial=${encodeURIComponent(text)}`);
        }}
      />
    </>
  );
}
