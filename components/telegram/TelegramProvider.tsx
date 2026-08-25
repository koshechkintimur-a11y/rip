'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type TelegramContextType = {
  isTelegram: boolean;
  platform: string;
  colorScheme: 'light' | 'dark';
  initData: string;
  /** true после того, как решили: SDK загрузился (Telegram) или его нет (браузер) */
  resolved: boolean;
};

const TelegramContext = createContext<TelegramContextType>({
  isTelegram: false,
  platform: 'unknown',
  colorScheme: 'dark',
  initData: '',
  resolved: false,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

/**
 * Провайдер контекста Telegram для всего приложения.
 * ВАЖНО: скрипт telegram-web-app.js грузится async — window.Telegram может
 * появиться НЕ сразу. Ждём его до 4 секунд (опрос каждые 50мс), только потом
 * ставим resolved=true, чтобы корневая страница не увела пользователя
 * на обычный логин до того, как мы узнали, что это Telegram.
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<TelegramContextType>({
    isTelegram: false,
    platform: 'unknown',
    colorScheme: 'dark',
    initData: '',
    resolved: false,
  });

  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initData) {
          if (!alive) return;
          clearInterval(iv);
          // разворачиваем Mini App на весь экран (по умолчанию Telegram открывает
          // плавающее окно, которое пользователь может растягивать)
          try {
            tg.ready?.();
            tg.expand?.();
            // UI-015: повторный expand через 500мс (Telegram может не успеть)
            setTimeout(() => { try { tg.expand?.(); } catch {} }, 500);
            // полноэкранный режим на мобильных + unknown (безопасно)
            const platform = tg.platform || 'unknown';
            const isMobile = ['ios', 'android', 'unknown'].includes(platform);
            if (isMobile && typeof tg.requestFullscreen === 'function') {
              try { tg.requestFullscreen(); } catch {}
            }
            tg.setBackgroundColor?.('#0a0a0c');
            tg.setHeaderColor?.('#0a0a0c');
            tg.disableVerticalSwipes?.();
          } catch { /* не критично */ }
          setCtx({
            isTelegram: true,
            platform: tg.platform || 'unknown',
            colorScheme: tg.colorScheme || 'dark',
            initData: tg.initData,
            resolved: true,
          });
          return;
        }
      } catch { /* */ }
      // 4 секунды прошло — считаем, что это не Telegram
      if (attempts >= 80) {
        if (!alive) return;
        clearInterval(iv);
        setCtx(prev => ({ ...prev, resolved: true }));
      }
    }, 50);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return (
    <TelegramContext.Provider value={ctx}>
      {children}
    </TelegramContext.Provider>
  );
}