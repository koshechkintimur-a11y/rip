import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type GifHit = { url: string; preview: string; title: string };

/**
 * Поиск GIF через Klipy API v1.
 * Ключ в пути: /api/v1/{GIF_PROVIDER_KEY}/gifs/search?q=...
 * Без ключа — ошибка с подсказкой (ручная вставка URL).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'Нет запроса' }, { status: 400 });

  const key = process.env.GIF_PROVIDER_KEY;

  if (!key) {
    return NextResponse.json({ error: 'GIF-провайдер не настроен. Вставь URL гифки вручную или добавь GIF_PROVIDER_KEY в .env' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.klipy.com/api/v1/${key}/gifs/search?q=${encodeURIComponent(q)}&page=1&per_page=15`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Klipy ${res.status}`);
    const body = await res.json();
    if (!body.result || !body.data?.data) throw new Error('Неверный формат ответа Klipy');

    const gifs = (body.data.data as any[]).map((r: any) => {
      const gifUrl = r.file?.hd?.gif?.url || r.file?.sd?.gif?.url || null;
      const preview = r.file?.hd?.jpg?.url || r.file?.sd?.jpg?.url || gifUrl;
      return {
        url: gifUrl,
        preview,
        title: r.title || '',
      };
    }).filter((g: GifHit) => g.url);

    return NextResponse.json({ gifs });
  } catch (e: any) {
    return NextResponse.json({ error: 'Не удалось найти гифки: ' + e.message }, { status: 502 });
  }
}