import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Noto_Serif_SC, Noto_Sans_SC, Ma_Shan_Zheng } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout";
import { LoginSheet } from "@/components/auth/LoginSheet";

const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-serif",
  display: "swap",
});

const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * M4.29 书法字体（手写宋）— 仅在仪式特化卡片标题使用
 * Ma Shan Zheng 仅 Regular weight，Google Fonts 覆盖中文常用字（含繁简）
 * + 拉丁字符。chinese-simplified 子集自动按 unicode-range 切片，按需加载。
 */
const maShanZheng = Ma_Shan_Zheng({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-calligraphy",
  display: "swap",
  preload: false, // 非首屏关键字体，懒加载省 LCP
});

export const metadata: Metadata = {
  title: "轻运 AI",
  description: "AI 占卜与每日运势 · 1 人 5 周 MVP",
  appleWebApp: {
    capable: true,
    title: "轻运",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#C9A1D9",
  width: "device-width",
  initialScale: 1,
  // a11y：允许用户缩放（视障用户 + lighthouse 要求 maximumScale≥5 / userScalable=true）
  maximumScale: 5,
  userScalable: true,
  // iPhone safe-area：让 env(safe-area-inset-*) 实际生效（cover 让 viewport
  // 延伸到刘海/Home Bar 边缘，再用 padding 让内容退避）
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn(
        "h-full antialiased",
        notoSerif.variable,
        notoSans.variable,
        maShanZheng.variable,
      )}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppShell>{children}</AppShell>
        <LoginSheet />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
