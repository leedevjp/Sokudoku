import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Sokudoku', description: '日本語の意味と読みをすばやく認識するトレーニング' };
export default function RootLayout({children}: {children: React.ReactNode}) {
 return <html lang="ja"><body>{children}</body></html>;
}
