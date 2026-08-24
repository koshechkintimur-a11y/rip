import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TelegramProvider } from '@/components/telegram/TelegramProvider';

export const metadata: Metadata = {
  title: 'RIP',
  description: 'Социальная сеть, где всё умирает',
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // чтобы safe-area (dynamic island / home indicator) работали
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Telegram Mini App SDK — self-hosted (telegram.org блокируется в РФ) */}
        <script src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/telegram-web-app.js`} />
      </head>
      <body className="min-h-dvh bg-rip-bg text-rip-text antialiased">
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
