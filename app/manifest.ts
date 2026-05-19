import type { MetadataRoute } from "next";

/**
 * PWA manifest（spec §6.5 必做项之一）
 *
 * - 用户可『添加到主屏幕』后看到 launcher 图标
 * - theme_color 用素笺淡紫，呼应 token --color-accent-lavender
 * - icon 用 SVG（无栅格依赖），未来需要 maskable PNG 时再补
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "福小运",
    short_name: "福小运",
    description: "AI 占卜与每日运势 · 1 人 5 周 MVP",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF5FB",
    theme_color: "#C9A1D9",
    lang: "zh-CN",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
