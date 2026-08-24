'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/components/telegram/TelegramProvider';
import { TelegramBootstrap } from '@/components/telegram/TelegramBootstrap';

/** Корень: в Telegram — seamless auth через initData; в браузере — обычный flow. */
export default function Home() {
  const router = useRouter();
  const { isTelegram, resolved } = useTelegram();

  useEffect(() => {
    // ждём, пока TelegramProvider решит (SDK загрузился или нет)
    if (!resolved) return;
    if (isTelegram) return; // TelegramBootstrap сам разберётся
    // браузер: проверяем сессию и отправляем
    (async () => {
      try {
        const r = await fetch('/api/auth/me');
        const d = await r.json().catch(() => null);
        router.replace(d?.user ? '/feed' : '/onboarding');
      } catch {
        router.replace('/onboarding');
      }
    })();
  }, [isTelegram, resolved, router]);

  if (!resolved) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-rip-bg">
        <p className="text-sm text-rip-dim animate-pulse">RIP…</p>
      </div>
    );
  }

  if (isTelegram) return <TelegramBootstrap />;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-rip-bg">
      <p className="text-sm text-rip-dim animate-pulse">RIP…</p>
    </div>
  );
}
