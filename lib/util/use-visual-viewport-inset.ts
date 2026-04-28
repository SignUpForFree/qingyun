"use client";

import * as React from "react";

/**
 * iOS Safari 键盘弹起时 visualViewport.height < layoutViewport.height，
 * 但 sticky bottom-0 仍贴 layout 视口底部 → 输入框被键盘半盖。
 *
 * 这个 hook 返回"应该往上抬多少 px"，组件可以塞进 style.paddingBottom 或
 * style.transform 把 sticky 元素从键盘下面顶出来。
 *
 * 桌面端 / 不支持 visualViewport 的环境返回 0，无副作用。
 */
export function useVisualViewportInset(): number {
  const [inset, setInset] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // 键盘高度 ≈ window.innerHeight - vv.height - vv.offsetTop
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // 小于 60px 通常是 iOS toolbar 收起，不算键盘
      setInset(offset > 60 ? offset : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
