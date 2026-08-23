'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useWorld } from '@/components/world-provider';
import { formatCountdown } from '@/lib/phases';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet } from '@/lib/api';

/**
 * Dying UI — интерфейс, который постепенно умирает вместе с сезоном.
 * A calm → B warning → C critical → D emergency → E final → F death
 * ВАЖНО: технические ошибки НЕ выглядят как смерть — у них отдельный стиль.
 */
export function DyingUI({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  const { phase, remainingMs, season } = useWorld();
  const [notifCount, setNotifCount] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // измеряем высоту шапки, чтобы sticky-элементы (лента внимания) вставали ровно под ней
  useEffect(() => {
    const update = () => {
      const h = headerRef.current?.offsetHeight ?? 0;
      rootRef.current?.style.setProperty('--rip-header-h', `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  // счётчик новых ответов на мои сообщения (для колокольчика)
  useEffect(() => {
    if (phase === 'death') return;
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ notifications: Array<{ is_new: boolean }> }>('/api/notifications');
        if (alive) setNotifCount((d.notifications || []).filter((n) => n.is_new).length);
      } catch { /* тихо */ }
    };
    void load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [phase]);

  const isDead = phase === 'death';
  const isFinal = phase === 'final';
  const isEmergency = phase === 'emergency';
  const isCritical = phase === 'critical';

  const showCountdown = !isDead;
  const showNav = !isFinal && !isDead;
  // progressive destruction
  const showComposer = remainingMs > 5 * 60 * 1000 && !isDead;
  const showAttention = remainingMs > 3 * 60 * 1000 && !isDead;
  const showDm = remainingMs > 10 * 60 * 1000 && !isDead;
  const showSecondary = remainingMs > 60 * 60 * 1000 && !isDead;

  const countdownTone = isFinal ? 'text-rip-blood animate-pulse-hard' : isEmergency ? 'text-rip-warn' : 'text-rip-text';

  return (
    <div ref={rootRef} className={`min-h-dvh ${isFinal ? 'contrast-125' : ''}`}>
      {/* ШАПКА: COUNTDOWN — опущена от safe-area (dynamic island), sticky с отступом */}
      <AnimatePresence>
        {showCountdown && (
          <motion.header
            ref={headerRef}
            exit={{ opacity: 0, y: -10 }}
            className={`sticky top-0 z-30 border-b border-rip-line bg-rip-bg/90 backdrop-blur px-4 pt-[calc(env(safe-area-inset-top,0px)+6px)] pb-2 ${isFinal ? 'animate-pulse' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-rip-dim tracking-widest shrink-0">RIP</span>
              <div className={`text-center font-mono ${countdownTone} ${isFinal ? 'text-base' : isEmergency ? 'text-sm' : 'text-xs'} tracking-wider`}>
                {season && remainingMs > 0 && (
                  <>
                    <span className="text-rip-dim">СЕЗОН #{season.number}</span>
                    <span className="mx-1 text-rip-dim">·</span>
                    ОСТАЛОСЬ {formatCountdown(remainingMs)}
                  </>
                )}
                {season && remainingMs <= 0 && !isDead && (
                  <span className="text-rip-blood">СЕЗОН #{season.number} ЗАВЕРШАЕТСЯ…</span>
                )}
              </div>
              <Link href="/notifications" className="relative w-8 text-right shrink-0" title="Ответы на мои сообщения">
                <span className="text-base leading-none">🔔</span>
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rip-blood text-white text-[9px] flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </Link>
            </div>
            {isFinal && (
              <p className="text-center text-[10px] text-rip-blood mt-1 tracking-wider leading-tight">
                ⚠️ СЕЗОН ЗАВЕРШАЕТСЯ. Некоторые элементы мира могут исчезать. Это нормально.
              </p>
            )}
          </motion.header>
        )}
      </AnimatePresence>

      {/* КОНТЕНТ */}
      <main className="pb-24 pt-1">{children}</main>

      {/* НИЖНЯЯ НАВИГАЦИЯ — исчезает в финальной фазе */}
      <AnimatePresence>
        {showNav && nav && (
          <motion.div exit={{ opacity: 0, transition: { duration: 2 } }}>{nav}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
