'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorld } from '@/components/world-provider';

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#8b8b95'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

function MailIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#8b8b95'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#8b8b95'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8e8ea' : '#8b8b95'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/** Нижняя навигация: Главная · Личка · Уведомления · Профиль (SVG-иконки + safe-area). */
export function BottomNav({ username }: { username: string }) {
  const pathname = usePathname();
  const { unreadDm, notifCount } = useWorld();

  const item = (href: string, icon: React.ReactNode, label: string, badge?: number) => {
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        className={`relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors ${
          active ? 'text-rip-text' : 'text-rip-dim'
        }`}
      >
        {icon}
        <span>{label}</span>
        {!!badge && (
          <span className="absolute top-1 right-[26%] min-w-[16px] h-4 px-1 rounded-full bg-rip-blood text-white text-[10px] flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl border-t border-rip-line bg-rip-bg/95 backdrop-blur z-40 grid grid-cols-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {item('/feed', <HomeIcon active={pathname === '/feed'} />, 'Чат')}
      {item('/dm', <MailIcon active={pathname.startsWith('/dm')} />, 'Личка', unreadDm)}
      {item('/notifications', <BellIcon active={pathname.startsWith('/notifications')} />, 'Уведомления', notifCount)}
      {item('/profile', <UserIcon active={pathname.startsWith('/profile')} />, 'Профиль')}
    </nav>
  );
}
