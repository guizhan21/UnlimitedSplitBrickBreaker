import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unlimited Split Brick Breaker",
  description: "A dense 108-level canvas brick breaker with unlimited split balls."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
