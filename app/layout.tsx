import type { Metadata, Viewport } from 'next';
import { Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { TelegramProvider } from '@/components/telegram/TelegramProvider';

// антиква для заголовков (как надпись на памятнике), моноширинная — для таймеров/дат
const playfair = Playfair_Display({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-serif',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RIP',
  description: 'Социальная сеть, где всё умирает',
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // чтобы safe-area (dynamic island / home indicator) работали
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${playfair.variable} ${jetbrains.variable}`}>
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
