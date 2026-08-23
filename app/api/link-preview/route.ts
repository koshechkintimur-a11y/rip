import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Парсит OpenGraph/мета-теги страницы для превью ссылки. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const url = new URL(req.url);
  const target = url.searchParams.get('url') || '';
  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: 'Некорректная ссылка' }, { status: 400 });
  }
  // SSRF-защита: только http/https, без localhost/приватных адресов
  try {
    const u = new URL(target);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return NextResponse.json({ error: 'Ссылка недоступна' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Некорректная ссылка' }, { status: 400 });
  }

  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RIPBot/1.0; +https://rip.local)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = (await res.text()).slice(0, 300_000);

    const meta = (name: string) => {
      const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i');
      const m = html.match(re);
      return m ? decodeEntities(m[1]).trim() : null;
    };
    const title = meta('og:title') || meta('twitter:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    const description = meta('og:description') || meta('twitter:description') || meta('description') || null;
    let image = meta('og:image') || meta('twitter:image') || null;
    if (image && image.startsWith('/')) {
      image = new URL(image, target).href;
    }

    return NextResponse.json({
      url: target,
      title: title?.slice(0, 120) || null,
      description: description?.slice(0, 250) || null,
      image,
      hostname: new URL(target).hostname,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Не удалось загрузить превью: ' + e.message }, { status: 502 });
  }
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
}