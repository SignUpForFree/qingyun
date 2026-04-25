import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "轻运 AI",
  description: "AI 占卜与每日运势 · 1 人 5 周 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
