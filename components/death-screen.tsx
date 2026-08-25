'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorld } from '@/components/world-provider';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPost } from '@/lib/api';

/** Полноэкранная смерть сезона: статистика → YOU RIP → ПРОДОЛЖИТЬ */
export function DeathScreen() {
  const { phase, season, stats, continueToNextSeason } = useWorld();
  const router = useRouter();
  const [showStats, setShowStats] = useState(false);
  const [showRip, setShowRip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isDead = phase === 'death';

  useEffect(() => {
    if (!isDead) return;
    setShowStats(false);
    setShowRip(false);
    setError(null);
    const t1 = setTimeout(() => setShowStats(true), 1200);
    const t2 = setTimeout(() => setShowRip(true), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isDead]);

  const cont = async () => {
    setBusy(true);
    setError(null);
    try {
      await continueToNextSeason();
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Не удалось начать новый сезон');
    }
    setBusy(false);
  };

  return (
    <AnimatePresence>
      {isDead && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center px-8 text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showStats ? 1 : 0, y: showStats ? 0 : 20 }}
            transition={{ duration: 1 }}
            className="space-y-3"
          >
            <p className="text-2xl text-rip-blood font-bold tracking-widest">
              ☠ СЕЗОН #{season?.number ?? '?'} ЗАВЕРШЁН
            </p>
            <p className="text-rip-dim text-sm">
              {Number(stats?.dead_messages ?? 0).toLocaleString('ru-RU')} сообщений погибло.
              {' '}{Number(stats?.survived_total ?? 0).toLocaleString('ru-RU')} выжило.
            </p>
            <p className="mt-3 text-rip-dim/60 text-xs italic">
              Интернет всё помнит. Этот — нет.
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: showRip ? 1 : 0 }}
            transition={{ duration: 1.2 }}
            className="rip-serif text-5xl font-black tracking-[0.3em] text-rip-text mt-10"
          >
            YOU RIP
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showRip ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            className="mt-12"
          >
            <button
              onClick={() => void cont()}
              disabled={busy}
              className="border border-rip-text/40 text-rip-text px-8 py-3 text-sm tracking-widest hover:bg-rip-text hover:text-black transition-colors disabled:opacity-40"
            >
              {busy ? '...' : '[ ПРОДОЛЖИТЬ ]'}
            </button>
            {error && <p className="mt-3 text-xs text-rip-warn">⚠️ {error}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}