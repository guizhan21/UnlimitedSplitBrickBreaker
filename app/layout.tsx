import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "無限分裂打磚塊",
  description: "高密度多球彈珠打磚塊遊戲"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
