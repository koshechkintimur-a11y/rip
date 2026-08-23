'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { timeAgo, plural } from '@/lib/phases';
import { Avatar } from '@/components/avatar';

type Notif = {
  kind: 'comment' | 'reaction';
  answer_id?: string;
  answer_content?: string;
  answered_at?: string;
  answer_username?: string;
  answer_avatar_url?: string | null;
  root_id?: string;
  root_content?: string;
  total_replies?: number;
  reaction_id?: string;
  reacted_at?: string;
  reactor_username?: string;
  reactor_avatar_url?: string | null;
  message_id?: string;
  message_content?: string;
  is_new?: boolean;
};

/** Экран уведомлений: ответы на мои сообщения + кто поставил 💀. */
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
  const reactions = notifs.filter((n) => n.kind === 'reaction');
  const comments = notifs.filter((n) => n.kind === 'comment');

  return (
    <div>
      <button onClick={() => router.push('/feed')} className="px-4 pt-3 pb-1 text-xs text-rip-dim hover:text-rip-text">
        ← чат
      </button>
      <h1 className="px-4 pt-1 pb-2 text-sm font-bold tracking-wider flex items-center gap-2">
        🔔 УВЕДОМЛЕНИЯ
        {newCount > 0 && (
          <span className="text-[10px] text-rip-warn border border-rip-warn/50 rounded px-1.5 py-0.5">
            {newCount} {plural(newCount, ['новое', 'новых', 'новых'])}
          </span>
        )}
      </h1>

      {loading && <p className="px-4 text-sm text-rip-dim animate-pulse">загружаем…</p>}

      {!loading && notifs.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-rip-dim">
          Пока тихо.
          <br />
          <span className="text-xs">Когда кто-то ответит в ветке или поставит 💀 — появится здесь.</span>
        </div>
      )}

      {/* РЕАКЦИИ: кто поставил черепок */}
      {reactions.length > 0 && (
        <div className="mb-2">
          <p className="px-4 py-1.5 text-[10px] text-rip-dim tracking-widest">💀 РЕАКЦИИ</p>
          {reactions.map((n) => (
            <div
              key={n.reaction_id}
              onClick={() => router.push(`/message/${n.message_id}`)}
              className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-rip-panel/40 transition-colors ${
                n.is_new ? 'bg-rip-warn/5 border-l-2 border-l-rip-warn' : ''
              }`}
            >
              <button onClick={(e) => { e.stopPropagation(); router.push(`/profile/${n.reactor_username}`); }}>
                <Avatar url={n.reactor_avatar_url} username={n.reactor_username} size={36} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold" onClick={(e) => { e.stopPropagation(); router.push(`/profile/${n.reactor_username}`); }}>@{n.reactor_username}</span>{' '}
                  <span className="text-rip-dim">поставил 💀</span>
                </p>
                <p className="text-xs text-rip-dim truncate mt-0.5">«{n.message_content}»</p>
              </div>
              <span className="text-lg shrink-0">💀</span>
              <span className="text-[10px] text-rip-dim/60 shrink-0">{timeAgo(n.reacted_at || '')}</span>
            </div>
          ))}
        </div>
      )}

      {/* КОММЕНТАРИИ */}
      {comments.length > 0 && (
        <div>
          <p className="px-4 py-1.5 text-[10px] text-rip-dim tracking-widest">💬 ОТВЕТЫ В ДИСКУССИЯХ</p>
          {comments.map((n) => (
            <div
              key={n.answer_id}
              onClick={() => router.push(`/message/${n.root_id}`)}
              className={`px-4 py-3 border-b border-rip-line/50 cursor-pointer hover:bg-rip-panel/40 transition-colors ${
                n.is_new ? 'bg-rip-warn/5 border-l-2 border-l-rip-warn' : ''
              }`}
            >
              <div className="flex items-baseline gap-2 text-[11px] text-rip-dim">
                <button className="flex items-center gap-1.5 hover:text-rip-text" onClick={(e) => { e.stopPropagation(); router.push(`/profile/${n.answer_username}`); }}>
                  <Avatar url={n.answer_avatar_url} username={n.answer_username} size={18} />
                  <span className="text-rip-text font-medium">@{n.answer_username}</span>
                </button>
                <span>ответил в дискуссии</span>
                <span className="ml-auto shrink-0">{timeAgo(n.answered_at || '')}</span>
              </div>
              <p className="mt-1 text-sm break-words">{n.answer_content}</p>
              <div className="mt-1.5 text-[11px] text-rip-dim/70 border-l-2 border-rip-line pl-2 truncate">
                «{n.root_content}» · ↳ {n.total_replies} {plural(n.total_replies || 0, ['ответ', 'ответа', 'ответов'])}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
