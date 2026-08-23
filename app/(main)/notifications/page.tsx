'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { timeAgo, plural } from '@/lib/phases';

type Notif = {
  answer_id: string;
  answer_content: string;
  answered_at: string;
  answer_username: string;
  root_id: string;
  root_content: string;
  total_replies: number;
  is_new: boolean;
};

/** Экран уведомлений: все ответы на мои сообщения в любых ветках. */
export default function NotificationsPage() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ notifications: Notif[] }>('/api/notifications');
        if (alive) setNotifs(d.notifications || []);
      } catch { /* тихо */ }
      setLoading(false);
    };
    void load();
    const id = setInterval(load, 10000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const newCount = notifs.filter((n) => n.is_new).length;

  return (
    <div>
      <button onClick={() => router.push('/feed')} className="px-4 pt-3 pb-1 text-xs text-rip-dim hover:text-rip-text">
        ← чат
      </button>
      <h1 className="px-4 pt-1 pb-2 text-sm font-bold tracking-wider flex items-center gap-2">
        🔔 ОТВЕТЫ НА МОИ СООБЩЕНИЯ
        {newCount > 0 && (
          <span className="text-[10px] text-rip-warn border border-rip-warn/50 rounded px-1.5 py-0.5">
            {newCount} {plural(newCount, ['новый', 'новых', 'новых'])}
          </span>
        )}
      </h1>

      {loading && <p className="px-4 text-sm text-rip-dim animate-pulse">загружаем…</p>}

      {!loading && notifs.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-rip-dim">
          Пока тихо.
          <br />
          <span className="text-xs">Когда кто-то ответит в ветке, где ты участвовал — это появится здесь.</span>
        </div>
      )}

      <div>
        {notifs.map((n) => (
          <div
            key={n.answer_id}
            onClick={() => router.push(`/message/${n.root_id}`)}
            className={`px-4 py-3 border-b border-rip-line/50 cursor-pointer hover:bg-rip-panel/40 transition-colors ${
              n.is_new ? 'bg-rip-warn/5 border-l-2 border-l-rip-warn' : ''
            }`}
          >
            <div className="flex items-baseline gap-2 text-[11px] text-rip-dim">
              <span className="text-rip-text font-medium">@{n.answer_username}</span>
              <span>ответил в дискуссии</span>
              <span className="ml-auto shrink-0">{timeAgo(n.answered_at)}</span>
            </div>
            <p className="mt-1 text-sm break-words">{n.answer_content}</p>
            <div className="mt-1.5 text-[11px] text-rip-dim/70 border-l-2 border-rip-line pl-2 truncate">
              «{n.root_content}» · ↳ {n.total_replies} {plural(n.total_replies, ['ответ', 'ответа', 'ответов'])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
