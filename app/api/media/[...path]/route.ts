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
};

/** Раздача загруженных файлов. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const name = parts.join('/');
  const base = path.basename(name);
  if (base !== name || !/^[a-zA-Z0-9._-]+$/.test(base)) {
    return NextResponse.json({ error: 'Bad name' }, { status: 400 });
  }
  const filePath = path.join(getCwd(), 'data', 'uploads', base);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ext = base.split('.').pop()?.toLowerCase() || '';
  const buf = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
