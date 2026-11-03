import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { SettingsProvider } from "@/components/settings/settings-provider";
import "./globals.css";
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Sokudoku · 速読",
  description: "日本語の意味と読みをすばやく認識するトレーニング",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f8ff",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={outfit.variable}>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
