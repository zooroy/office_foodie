import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/query-provider';
import { BackendGate } from '@/components/backend-gate';

export const metadata: Metadata = {
  title: 'Office Foodie｜辦公室揪團點餐',
  description: '一起訂午餐，輕鬆整理點餐與收款。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen antialiased">
        <BackendGate>
          <QueryProvider>{children}</QueryProvider>
        </BackendGate>
      </body>
    </html>
  );
}
