import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Публичный VAPID-ключ для клиента. */
export async function GET() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pub) return NextResponse.json({ error: 'VAPID не настроен' }, { status: 500 });
  return NextResponse.json({ publicKey: pub });
}
