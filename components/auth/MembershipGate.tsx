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
 * 当前阶段会员制度暂不控制，直接渲染 children。
 * 后续启用会员时恢复 premium 判断逻辑。
 */
export function MembershipGate({ children }: MembershipGateProps) {
  return <>{children}</>;
}
