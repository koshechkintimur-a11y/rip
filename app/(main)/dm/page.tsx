'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { Avatar } from '@/components/avatar';
import { formatTime } from '@/lib/phases';

type Conv = {
  id: string;
  other_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url?: string | null;
  last_message: string | null;
  unread: number;
  created_at: string;
};

/** Список личных диалогов. */
export default function DmListPage() {
  const { refresh } = useWorld();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ conversations: Conv[] }>('/api/dm');
        if (alive) setConvs(d.conversations || []);
      } catch { /* тихо */ }
      setLoading(false);
    };
    void load();
    const id = setInterval(() => { void load(); void refresh(); }, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [refresh]);

  return (
    <div>
      <h1 className="px-4 pt-3 pb-2 text-sm font-bold tracking-wider">✉ ЛИЧНЫЕ СООБЩЕНИЯ</h1>

      {loading && <p className="px-4 text-sm text-rip-dim animate-pulse">загружаем…</p>}

      {!loading && convs.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-rip-dim">
          Пока ни одного диалога.
          <br />
          <span className="text-xs">Открой чей-нибудь профиль и напиши первым.</span>
        </div>
      )}

      <div>
        {convs.map((c) => (
          <Link
            key={c.id}
            href={`/dm/${c.id}`}
            className="flex items-center gap-3 px-4 py-3 border-b border-rip-line/50 hover:bg-rip-panel/40 transition-colors"
          >
            <Avatar url={c.other_avatar_url} username={c.other_username} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium truncate">{c.other_display_name || c.other_username}</span>
                <span className="text-[10px] text-rip-dim shrink-0">@{c.other_username}</span>
              </div>
              <p className={`text-xs truncate mt-0.5 ${c.unread ? 'text-rip-text' : 'text-rip-dim'}`}>
                {c.last_message || '…'}
              </p>
            </div>
            {c.unread > 0 && (
              <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-rip-blood text-white text-[10px] flex items-center justify-center">
                {c.unread}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
