import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RIP',
  description: 'Социальная сеть, где всё умирает',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // чтобы safe-area (dynamic island / home indicator) работали
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-rip-bg text-rip-text font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
