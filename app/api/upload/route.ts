import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getMediaStorage } from '@/lib/media/storage';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

export const runtime = 'nodejs';

const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const MAX_SIZE = {
  image: 20 * 1024 * 1024,     // 20 MB — современные фото с телефонов (HEIC 8-12MB)
  gif: 10 * 1024 * 1024,       // 10 MB
  video: 30 * 1024 * 1024,     // 30 MB
};

/** SEC-015: проверка реального содержимого файла (magic bytes), а не file.type от клиента. */
function detectMime(buf: Uint8Array): string | null {
  const b = (i: number) => buf[i];
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (buf.length >= 3 && b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return 'image/jpeg';
  // GIF: 47 49 46 38 ("GIF8")
  if (buf.length >= 6 && b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return 'image/gif';
  // WebP: RIFF....WEBP (bytes 8-11)
  if (buf.length >= 12 && b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return 'image/webp';
  // ISO-BMFF (MP4/HEIC/HEIF): ....ftyp<brand>
  if (buf.length >= 12 && b(4) === 0x66 && b(5) === 0x74 && b(6) === 0x79 && b(7) === 0x70) {
    const brand = String.fromCharCode(b(8), b(9), b(10), b(11)).toLowerCase();
    if (['heic', 'heif', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
    if (['mp42', 'mp41', 'isom', 'iso2', 'avc1', 'dash', 'qt  '].includes(brand)) return 'video/mp4';
    return 'video/mp4'; // generic ISO-BMFF → mp4
  }
  // WebM/Matroska: 1A 45 DF A3 (EBML)
  if (buf.length >= 4 && b(0) === 0x1A && b(1) === 0x45 && b(2) === 0xDF && b(3) === 0xA3) return 'video/webm';
  return null;
}

/** Загрузка медиа (image/gif/video) в storage (локальный или S3). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`upload:${user.id}`, 20, 60_000)) return tooMany(); // SEC-007

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Нет файла' }, { status: 400 });

  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return NextResponse.json({ error: 'Нужна картинка или видео (PNG/JPEG/WebP/GIF/HEIC/MP4/WebM)' }, { status: 400 });
  }

  const category = file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
  const maxSize = MAX_SIZE[category] || 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const limit = maxSize / 1024 / 1024;
    return NextResponse.json({ error: `Файл слишком большой. Максимум ${limit} МБ для ${category}` }, { status: 400 });
  }

  // SEC-015: реальное содержимое должно соответствовать заявленному MIME
  const buf = Buffer.from(await file.arrayBuffer());
  const actual = detectMime(new Uint8Array(buf));
  if (!actual) {
    return NextResponse.json({ error: 'Не удалось распознать формат файла' }, { status: 400 });
  }
  const expectedBase = file.type.split('/')[0];
  if (actual.split('/')[0] !== expectedBase || !ALLOWED_MIME[actual]) {
    return NextResponse.json({ error: 'Содержимое файла не соответствует типу' }, { status: 400 });
  }
  // расширение из РЕАЛЬНОГО типа, а не из file.type клиента
  const ext = ALLOWED_MIME[actual];
  const name = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const storage = getMediaStorage();
  const { url } = await storage.save(name, buf, actual);

  const mediaType = actual.startsWith('video/') ? 'video' : actual === 'image/gif' ? 'gif' : 'image';
  return NextResponse.json({ ok: true, url, mediaType });
}