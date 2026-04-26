import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout";

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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn("h-full antialiased", notoSerif.variable, notoSans.variable)}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
