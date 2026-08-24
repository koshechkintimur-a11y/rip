import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { refreshAttention } from '@/lib/season/engine';
import { ensureWorldBirth } from '@/lib/season/engine';
import { attentionSchema, containsProfanity } from '@/lib/validation';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

export const dynamic = 'force-dynamic';

/** Активные и запланированные слоты внимания (для карточной ленты). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  await refreshAttention();
  const slots = await q(
    `select s.*, p.username
     from attention_slots s left join profiles p on p.id = s.user_id
     where s.status in ('active','scheduled') and s.ends_at > now()
     order by s.starts_at asc
     limit 30`
  );
  return NextResponse.json({ slots });
}

/** Купить слот(ы) внимания. Цена считается на сервере: 20 монет × 10 мин × слот. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`attn:${user.id}`, 5, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const parsed = attentionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Ошибка' }, { status: 400 });
  }
  const { content, slots, minutes, mediaUrl, mediaType, messageId } = parsed.data;
  if (containsProfanity(content)) {
    return NextResponse.json({ error: 'Текст отклонён фильтром' }, { status: 400 });
  }

  // Если слот не привязан к существующему сообщению — создаём сообщение из крика,
  // чтобы карточка внимания открывала полноценную ветку (message_id не null).
  let targetMessageId = messageId || null;
  if (!targetMessageId) {
    const season = await ensureWorldBirth();
    if ((season as any).status !== 'active') {
      return NextResponse.json({ error: 'Мир мёртв. Нажми CONTINUE, чтобы начать новый сезон.', code: 'world_dead' }, { status: 400 });
    }
    const msg = await qOne(
      `insert into messages (author_id, season_id, content, media_url, media_type, status)
       values ($1, $2, $3, $4, $5, 'active') returning id`,
      [user.id, (season as any).id, content, mediaUrl || null, mediaType || null]
    );
    if (msg) targetMessageId = msg.id;
  }

  // атомарная покупка в одной транзакции (блокировка кошелька = защита от double-spend)
  const res = await qOne<{ purchase_attention: { total_cost: number; ends_at: string } }>(
    `select purchase_attention($1, $2, $3, $4, $5, $6, $7)`,
    [user.id, content, slots, minutes, mediaUrl || null, mediaType || null, targetMessageId]
  );
  if (!res) return NextResponse.json({ error: 'Не удалось купить внимание' }, { status: 500 });
  const purchase = res.purchase_attention;

  const wallet = await qOne<{ balance: number }>(`select balance from wallets where user_id = $1`, [user.id]);
  return NextResponse.json({ ok: true, purchase, balance: wallet?.balance ?? 0, messageId: targetMessageId });
}
