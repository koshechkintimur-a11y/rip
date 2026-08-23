import { NextResponse } from 'next/server';
import { getCwd } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Раздача загруженных файлов. Путь: /api/media/<userId>/<имя> или /api/media/<имя>. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  // допускаем максимум userId/файл — защита от path traversal
  const clean = parts.filter((p) => /^[a-zA-Z0-9._-]+$/.test(p));
  if (clean.length !== parts.length || clean.length === 0 || clean.length > 2) {
    return NextResponse.json({ error: 'Bad name' }, { status: 400 });
  }
  const rel = clean.join('/');
  const filePath = path.join(getCwd(), 'data', 'uploads', rel);
  if (!filePath.startsWith(path.join(getCwd(), 'data', 'uploads'))) {
    return NextResponse.json({ error: 'Bad name' }, { status: 400 });
  }
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const base = clean[clean.length - 1];
  const ext = base.split('.').pop()?.toLowerCase() || '';
  const buf = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
