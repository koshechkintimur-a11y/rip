import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Поиск GIF через Tenor API v2.
 * Ключ: GIF_PROVIDER_KEY в .env (бесплатно на https://developers.google.com/tenor)
 * Без ключа возвращает ошибку с подсказкой.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const key = process.env.GIF_PROVIDER_KEY;
  if (!q) return NextResponse.json({ error: 'Нет запроса' }, { status: 400 });
  if (!key) {
    return NextResponse.json({ error: 'GIF_PROVIDER_KEY не настроен. Вставь URL гифки вручную или добавь ключ Tenor.' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://tenor.com/v2/search?q=${encodeURIComponent(q)}&key=${key}&limit=12&media_filter=minimal&contentfilter=medium`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Tenor ${res.status}`);
    const data = await res.json();
    const gifs = (data.results || []).map((r: any) => {
      const m = r.media_formats?.gif || r.media_formats?.tinygif;
      return {
        url: m?.url || null,
        preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || null,
        title: r.title || '',
      };
    }).filter((g: any) => g.url);
    return NextResponse.json({ gifs });
  } catch (e: any) {
    return NextResponse.json({ error: 'Не удалось найти гифки: ' + e.message }, { status: 502 });
  }
}
