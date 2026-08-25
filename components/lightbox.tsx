'use client';

import { createContext, useCallback, useContext, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LightboxCtx = { open: (url: string) => void };
const Ctx = createContext<LightboxCtx | null>(null);

/** Спиннер-лоадер (чёрный экран без него выглядит как зависание). */
function Spinner() {
  return (
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  );
}

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startY = useRef(0);

  const open = useCallback((u: string) => {
    setLoading(true);
    setUrl(u);
  }, []);

  const close = useCallback(() => setUrl(null), []);

  // свайп вниз (touch): сдвиг > 70px — закрыть
  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 70) close();
  };

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col h-dvh w-full overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={close} // тап по любому месту (включая фото) закрывает
          >
            {/* контент */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              {url && /\.(mp4|webm)(\?|$)/i.test(url) ? (
                <video
                  controls
                  autoPlay
                  playsInline
                  src={url}
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  {loading && <Spinner />}
                  <motion.img
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    src={url}
                    alt=""
                    draggable={false}
                    onLoad={() => setLoading(false)}
                    onError={() => setLoading(false)}
                    className={`max-w-full max-h-full object-contain select-none ${loading ? 'hidden' : ''}`}
                  />
                </>
              )}
            </div>

            {/* верхний крестик (с учётом safe-area) */}
            <button
              aria-label="Закрыть"
              className="absolute right-4 text-white/80 text-2xl w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
              onClick={(e) => { e.stopPropagation(); close(); }}
            >
              ✕
            </button>

            {/* крупная кнопка закрытия снизу — палец достаёт легко */}
            <div className="shrink-0 flex justify-center pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-2">
              <button
                className="px-8 py-3 rounded-full bg-white/10 text-white/80 text-sm hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); close(); }}
              >
                Закрыть · свайп вниз
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

export function useLightbox(): LightboxCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLightbox вне LightboxProvider');
  return ctx;
}
