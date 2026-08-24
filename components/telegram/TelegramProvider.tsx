'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type TelegramContextType = {
  isTelegram: boolean;
  platform: string;
  colorScheme: 'light' | 'dark';
  initData: string;
};

const TelegramContext = createContext<TelegramContextType>({
  isTelegram: false,
  platform: 'unknown',
  colorScheme: 'dark',
  initData: '',
});

export function useTelegram() {
  return useContext(TelegramContext);
}

/** Провайдер контекста Telegram для всего приложения. */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<TelegramContextType>({
    isTelegram: false,
    platform: 'unknown',
    colorScheme: 'dark',
    initData: '',
  });

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg || !tg.initData) {
        setCtx(prev => ({ ...prev, isTelegram: false }));
        return;
      }
      setCtx({
        isTelegram: true,
        platform: tg.platform || 'unknown',
        colorScheme: tg.colorScheme || 'dark',
        initData: tg.initData,
      });
    } catch {
      setCtx(prev => ({ ...prev, isTelegram: false }));
    }
  }, []);

  return (
    <TelegramContext.Provider value={ctx}>
      {children}
    </TelegramContext.Provider>
  );
}