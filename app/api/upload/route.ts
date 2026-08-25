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
  image: 5 * 1024 * 1024,      // 5 MB
  gif: 10 * 1024 * 1024,       // 10 MB
  video: 30 * 1024 * 1024,     // 30 MB
};

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

  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Формат не поддерживается. Используй JPG/PNG/WebP/GIF/MP4/WebM' }, { status: 400 });
  }

  const category = file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
  const maxSize = MAX_SIZE[category] || 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const limit = maxSize / 1024 / 1024;
    return NextResponse.json({ error: `Файл слишком большой. Максимум ${limit} МБ для ${category}` }, { status: 400 });
  }

  const name = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const storage = getMediaStorage();
  const { url } = await storage.save(name, buf, file.type);

  const mediaType = category === 'image' || category === 'gif' ? category : 'video';
  return NextResponse.json({ ok: true, url, mediaType });
}