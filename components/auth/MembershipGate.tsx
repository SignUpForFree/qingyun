"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MembershipGateProps {
  /** 功能名称，显示在弹窗标题 */
  feature: string;
  children: React.ReactNode;
  className?: string;
}

interface SubscriptionState {
  plan: "free" | "premium";
  expiresAt: string | null;
}

const Ctx = React.createContext<SubscriptionState>({ plan: "free", expiresAt: null });

/**
 * 在组件树顶层注入会员状态
 * 调一次 /api/me/subscription，子组件通过 useSubscription() 读取
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [sub, setSub] = React.useState<SubscriptionState>({ plan: "free", expiresAt: null });

  React.useEffect(() => {
    fetch("/api/me/subscription")
      .then((r) => r.json())
      .then((data: SubscriptionState) => setSub(data))
      .catch(() => { /* 默认 free */ });
  }, []);

  return <Ctx.Provider value={sub}>{children}</Ctx.Provider>;
}

export function useSubscription(): SubscriptionState {
  return React.useContext(Ctx);
}

/**
 * 会员锁定按钮包装器
 *
 * - premium 时正常渲染子元素
 * - 非 premium 时：按钮加锁图标 + 点击弹会员引导弹窗
 */
export function MembershipGate({ feature, children, className }: MembershipGateProps) {
  const sub = useSubscription();
  const [showModal, setShowModal] = React.useState(false);

  if (sub.plan === "premium") {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={cn("relative", className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
      >
        {children}
        {/* 锁定遮罩 */}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/10">
          <svg
            className="h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
      </div>

      {/* 会员引导弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowModal(false)}
        >
          <div
            className="mx-4 max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-ink-plum)]">
              解锁{feature}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-ink-fade)]">
              成为轻运会员，解锁全部深度解读功能，获得更完整、更专属的运势指引。
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-full border border-[var(--color-accent-lavender)]/40 px-4 py-2 text-sm text-[var(--color-ink-plum)]"
              >
                稍后再说
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  // TODO: 跳转会员购买页或微信支付
                }}
                className="flex-1 rounded-full bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] px-4 py-2 text-sm text-white shadow-pill"
              >
                了解会员
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
