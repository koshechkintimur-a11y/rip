import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getCwd } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/** Загрузка изображения на диск (data/uploads). Вернёт URL /api/media/<file>. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Нет файла' }, { status: 400 });

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Нужна картинка (PNG/JPEG/WebP/GIF/HEIC)' }, { status: 400 });
  }
  if (!allowed.includes(file.type) && file.type.startsWith('image/')) {
    // неизвестный image/* (например HEIC с другого устройства) — сохраняем как jpg
    return NextResponse.json({ error: 'Формат не поддерживается. Используй JPG/PNG/WebP/GIF' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Максимум 5 МБ' }, { status: 400 });
  }

  const dir = path.join(getCwd(), 'data', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const extMap: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' };
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extMap[file.type]}`;
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, name), buf);

  const mediaType = file.type === 'image/gif' ? 'gif' : 'image';
  return NextResponse.json({ ok: true, url: `/api/media/${name}`, mediaType });
}
