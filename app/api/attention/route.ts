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
    `select s.*, p.username,
            exists(select 1 from attention_reactions where slot_id = s.id and user_id = $1) as my_skull
     from attention_slots s left join profiles p on p.id = s.user_id
     where s.status in ('active','scheduled','echo')
     order by (s.status = 'echo') desc, s.starts_at asc
     limit 30`,
    [user.id]
  );
  // время следующей волны (daily_reset): прод 24ч, тесты TEST_SEASON_DURATION/24
  const season = await qOne<{ last_reset_at: string | null; started_at: string }>(
    `select last_reset_at, started_at from seasons where status = 'active' order by number desc limit 1`
  );
  const testDur = Number(process.env.TEST_SEASON_DURATION || 0);
  const intervalMs = testDur > 0 ? (testDur * 1000) / 24 : 24 * 3600 * 1000;
  const base = season?.last_reset_at ? new Date(season.last_reset_at) : season?.started_at ? new Date(season.started_at) : new Date();
  const nextWaveAt = new Date(base.getTime() + intervalMs).toISOString();
  // текущая цена слота (динамическая, от времени до волны) + риск
  const price = await qOne<{ unit_price: number }>(
    `select attention_unit_price()::int as unit_price`
  );
  const waveInMin = Math.max(0, Math.round((new Date(nextWaveAt).getTime() - Date.now()) / 60000));
  const chance = waveInMin > 240 ? 'высокий' : waveInMin > 60 ? 'средний' : 'низкий';
  return NextResponse.json({ slots, next_wave_at: nextWaveAt, unit_price: price?.unit_price ?? 20, wave_in_minutes: waveInMin, chance });
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
      `insert into messages (author_id, season_id, content, media_url, media_type, status, feed_hidden)
       values ($1, $2, $3, $4, $5, 'active', true) returning id`,
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
  // id созданных слотов — чтобы UI/тест мог черепить конкретный крик
  const created = await q<{ id: string }>(
    `select id from attention_slots
     where user_id = $1 and created_at > now() - interval '10 seconds'
     order by created_at desc limit $2`,
    [user.id, slots]
  );
  return NextResponse.json({ ok: true, purchase, balance: wallet?.balance ?? 0, messageId: targetMessageId, slotIds: created.map((r: any) => r.id) });
}
