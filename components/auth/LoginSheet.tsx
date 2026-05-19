"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PhoneLoginForm } from "@/components/auth/PhoneLoginForm";
import { onLoginModalOpen } from "@/lib/auth/login-bus";

/**
 * 全局登录弹窗（替代 /login 页 + /api/auth/wechat 重定向）
 *
 * - 监听 login-open 事件 → 弹窗
 * - 401 / 用户主动点登录都走同一入口
 * - 登录成功 onSuccess → 关弹窗 + router.refresh()，新档案需要 /onboarding 时整页跳
 */
export function LoginSheet() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => onLoginModalOpen(() => setOpen(true)), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-[16px] border-t border-[var(--color-accent-lavender)]/30 bg-[var(--color-bg-paper)] p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>登录</SheetTitle>
          <SheetDescription>手机号 + 6 位验证码登录</SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-6 pt-2">
          <p className="mb-5 text-center font-[family-name:var(--font-serif)] text-[17px] tracking-ritual text-[var(--color-ink-plum)]">
            欢迎回来
          </p>
          <PhoneLoginForm
            layout="compact"
            onSuccess={({ isNew }: { isNew: boolean }) => {
              setOpen(false);
              if (isNew) {
                router.replace("/onboarding");
              } else {
                router.refresh();
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
