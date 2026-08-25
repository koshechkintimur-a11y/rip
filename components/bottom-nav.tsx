'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorld } from '@/components/world-provider';
import { useComposer } from '@/components/composer-provider';
import { useEffect, useRef } from 'react';

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#5c5c66'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" />
    </svg>
  );
}
function MailIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#5c5c66'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#5c5c66'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
function SkullIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#5c5c66'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="7" /><line x1="12" y1="14" x2="12" y2="17" /><circle cx="9" cy="10" r="1.5" fill={active ? '#e8e8ea' : '#5c5c66'} /><circle cx="15" cy="10" r="1.5" fill={active ? '#e8e8ea' : '#5c5c66'} />
    </svg>
  );
}
function GraveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97f4f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="7" width="8" height="14" rx="1.5" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { unreadDm, notifCount } = useWorld();
  const { openComposer } = useComposer();
  const navRef = useRef<HTMLElement>(null);
  const lastY = useRef(0);

  // hide/show on scroll
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
      if (!navRef.current) return;
      navRef.current.style.transform = 'translateY(0)';
      navRef.current.style.transition = 'transform 0.3s ease';
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (!navRef.current) { lastY.current = y; return; }
      const dy = y - lastY.current;
      // экран статичен — показываем (debounce после остановки скролла)
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(show, 300);
      if (Math.abs(dy) < 5) return;
      if (y <= 0) {
        // на верху ленты — панель всегда видна
        show();
      } else if (dy > 0) {
        // скролл вниз — прячем
        navRef.current.style.transform = 'translateY(100%)';
        navRef.current.style.transition = 'transform 0.3s ease';
      } else {
        // скролл вверх — показываем
        show();
      }
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  const item = (href: string, icon: React.ReactNode, badge?: number) => {
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        className={`relative flex items-center justify-center py-2 transition-colors ${active ? 'text-rip-text' : 'text-rip-dim'}`}
      >
        {icon}
        {!!badge && (
          <span className="absolute top-0.5 right-[24%] min-w-[16px] h-4 px-1 rounded-full bg-rip-blood text-white text-[10px] flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-xl border-t border-rip-line bg-rip-bg/95 backdrop-blur z-40 grid grid-cols-5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {item('/feed', <HomeIcon active={pathname === '/feed'} />)}
      {item('/dm', <MailIcon active={pathname.startsWith('/dm')} />, unreadDm)}
      {/* центральная кнопка: надгробие → модалка поста */}
      <button
        onClick={openComposer}
        className="flex items-center justify-center py-2 transition-transform hover:scale-110 active:scale-95"
      >
        <GraveIcon />
      </button>
      {item('/notifications', <BellIcon active={pathname.startsWith('/notifications')} />, notifCount)}
      {item('/profile', <SkullIcon active={pathname.startsWith('/profile')} />)}
    </nav>
  );
}