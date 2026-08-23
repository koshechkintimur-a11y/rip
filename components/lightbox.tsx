'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LightboxCtx = { open: (url: string) => void };
const Ctx = createContext<LightboxCtx | null>(null);

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);

  const open = useCallback((u: string) => setUrl(u), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setUrl(null)}
          >
            {url && /\.(mp4|webm)(\?|$)/i.test(url) ? (
              <video
                controls
                autoPlay
                playsInline
                src={url}
                className="max-w-full max-h-full rounded"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                src={url}
                alt=""
                className="max-w-full max-h-full object-contain rounded"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <button
              className="absolute top-4 right-4 text-white/70 text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              onClick={() => setUrl(null)}
            >
              ✕
            </button>
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
