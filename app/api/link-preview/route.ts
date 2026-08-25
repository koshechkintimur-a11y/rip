import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

export const dynamic = 'force-dynamic';

/** Парсит OpenGraph/мета-теги страницы для превью ссылки. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`link:${user.id}`, 30, 60_000)) return tooMany();

  const url = new URL(req.url);
  const target = url.searchParams.get('url') || '';
  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: 'Некорректная ссылка' }, { status: 400 });
  }

  // SSRF-защита: только http/https, без localhost/приватных адресов
  const isSafeUrl = (u: URL): boolean => {
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return false;
    }
    return true;
  };

  try {
    const u = new URL(target);
    if (!isSafeUrl(u)) {
      return NextResponse.json({ error: 'Ссылка недоступна' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Некорректная ссылка' }, { status: 400 });
  }

  try {
    // ручные редиректы: каждый следующий URL проверяется от SSRF (redirect:'manual')
    let current = target;
    let res: Response | null = null;
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(current, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RIPBot/1.0; +https://rip.local)' },
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new Error('Редирект без location');
        const next = new URL(loc, current);
        if (!isSafeUrl(next)) {
          return NextResponse.json({ error: 'Ссылка недоступна' }, { status: 400 });
        }
        current = next.href;
        continue;
      }
      break;
    }
    if (!res) throw new Error('Нет ответа');
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
      image = new URL(image, current).href;
    }

    return NextResponse.json({
      url: current,
      title: title?.slice(0, 120) || null,
      description: description?.slice(0, 250) || null,
      image,
      hostname: new URL(current).hostname,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Не удалось загрузить превью: ' + e.message }, { status: 502 });
  }
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
}
