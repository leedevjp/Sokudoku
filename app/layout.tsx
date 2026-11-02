import type { Metadata, Viewport } from "next";
import { SettingsProvider } from "./settings";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sokudoku · 速読",
  description: "日本語の意味と読みをすばやく認識するトレーニング",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f9ff",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
