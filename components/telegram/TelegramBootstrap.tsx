'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/components/telegram/TelegramProvider';

/**
 * Авторизует пользователя Telegram через /api/auth/telegram.
 * Используется на главной: если открыто в Telegram — seamless login → feed.
 * Если НЕ в Telegram — не делает ничего (обычный браузерный flow).
 */
export function TelegramBootstrap() {
  const router = useRouter();
  const { isTelegram, initData } = useTelegram();
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isTelegram) return; // не в Telegram — ничего не делаем
    if (status !== 'idle') return;

    let alive = true;
    setStatus('loading');
    (async () => {
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        const d = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setStatus('error');
          setError(d?.error || 'Ошибка входа через Telegram');
          return;
        }
        setStatus('done');
        // deep link: start_param=m_<id> / thread_ / profile_ / ref_
        const sp = new URLSearchParams(initData).get('start_param');
        if (sp) {
          if (sp.startsWith('m_')) router.replace(`/message/${sp.slice(2)}`);
          else if (sp.startsWith('profile_')) router.replace(`/profile/${sp.slice(8)}`);
          else router.replace('/feed');
        } else {
          router.replace('/feed');
        }
        router.refresh();
      } catch (e: any) {
        if (!alive) return;
        setStatus('error');
        setError(e?.message || 'Сеть недоступна');
      }
    })();
    return () => { alive = false; };
  }, [isTelegram, initData, status, router]);

  if (!isTelegram || status === 'done') return null;
  if (status === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-rip-bg">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight mb-3">RIP</h1>
          <p className="text-sm text-rip-dim animate-pulse">входим в мир…</p>
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-rip-bg px-6">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-3">Не удалось войти</h1>
          <p className="text-sm text-rip-blood mb-4">{error}</p>
          <p className="text-xs text-rip-dim">Перезапусти приложение из Telegram</p>
        </div>
      </div>
    );
  }
  return null;
}