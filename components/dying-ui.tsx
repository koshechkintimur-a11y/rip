'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorld } from '@/components/world-provider';
import { useTelegram } from '@/components/telegram/TelegramProvider';
import { formatCountdown, getDeathState } from '@/lib/phases';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dying UI — интерфейс, который постепенно умирает вместе с сезоном.
 * A calm → B warning → C critical → D emergency → E final → F death
 * ВАЖНО: технические ошибки НЕ выглядят как смерть — у них отдельный стиль.
 */
export function DyingUI({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  const { phase, remainingMs, season } = useWorld();
  const { isTelegram } = useTelegram();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // название текущего раздела — как в концепте (ЧАТ · ЛИЧКА · УВЕДОМЛЕНИЯ · ПРОФИЛЬ)
  const sectionTitle =
    pathname === '/feed' ? 'ЧАТ'
    : pathname.startsWith('/dm') ? 'ЛИЧКА'
    : pathname.startsWith('/notifications') ? 'УВЕДОМЛЕНИЯ'
    : pathname.startsWith('/profile') ? 'ПРОФИЛЬ'
    : pathname.startsWith('/message') ? 'ВЕТКА'
    : pathname.startsWith('/seasons') ? 'СЕЗОНЫ'
    : '';

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

  const isDead = phase === 'death';
  const isFinal = phase === 'final';
  const isEmergency = phase === 'emergency';
  const isCritical = phase === 'critical';

  // единый источник состояния умирания — без дублирования логики
  const ds = getDeathState(remainingMs);
  const showCountdown = ds.showCountdown;
  const showNav = ds.showNav;

  const countdownTone = isFinal ? 'text-rip-blood animate-pulse-hard' : isEmergency ? 'text-rip-warn' : 'text-rip-text';

  return (
    <div ref={rootRef} className={`min-h-dvh ${isFinal ? 'contrast-125' : ''}`}>
      {/* ШАПКА: COUNTDOWN — опущена от safe-area (dynamic island), sticky с отступом */}
      <AnimatePresence>
        {showCountdown && (
          <motion.header
            ref={headerRef}
            exit={{ opacity: 0, y: -10 }}
            className={`sticky top-0 z-30 border-b border-rip-line bg-rip-bg/90 backdrop-blur px-4 pb-2 ${isFinal ? 'animate-pulse' : ''}`}
            style={{ paddingTop: isTelegram
              ? 'calc(env(safe-area-inset-top, 0px) + 40px)' // в Telegram fullscreen кнопки X/⋯ перекрывают верх
              : 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
          >
            <div className="flex items-center justify-between gap-2">
              {/* слева — название раздела (как в концепте: ЧАТ / ЛИЧКА / УВЕДОМЛЕНИЯ / ПРОФИЛЬ) */}
              <span className="rip-serif text-[13px] tracking-[0.18em] text-rip-bone shrink-0">{sectionTitle}</span>
              {/* справа — сезон с именем + сколько осталось (как в концепте: СЕЗОН #4 «ЭХО» · 2 ДНЯ 14 Ч) */}
              <div className={`font-mono ${isFinal ? 'text-base' : isEmergency ? 'text-sm' : 'text-xs'} tracking-wider text-right`}>
                {season && remainingMs > 0 && (
                  <>
                    <Link href="/seasons" className="text-rip-rust hover:text-rip-warn transition-colors" title="История сезонов">СЕЗОН #{season.number}{season.name ? ` «${season.name}»` : ''}</Link>
                    <span className="mx-1 text-rip-dim">·</span>
                    <span className="text-rip-dim">{formatCountdown(remainingMs)}</span>
                  </>
                )}
                {season && remainingMs <= 0 && !isDead && (
                  <Link href="/seasons" className="text-rip-rust hover:text-rip-warn transition-colors">СЕЗОН #{season.number} ЗАВЕРШАЕТСЯ…</Link>
                )}
              </div>
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
      <main className="pb-36 pt-1">{children}</main>

      {/* НИЖНЯЯ НАВИГАЦИЯ — исчезает в финальной фазе */}
      <AnimatePresence>
        {showNav && nav && (
          <motion.div exit={{ opacity: 0, transition: { duration: 2 } }}>{nav}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
