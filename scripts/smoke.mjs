/**
 * Смоук-тест ключевых SQL-функций (запускать после migrate + seed).
 * Использование: node scripts/smoke.mjs
 */
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const url = process.env.DATABASE_URL;
let db = url ? new Pool({ connectionString: url }) : new PGlite(path.join(root, '.ripdata'));

const checks = [];
async function check(name, fn) {
  try {
    const res = await fn();
    checks.push(`✅ ${name}${res ? ' — ' + res : ''}`);
  } catch (e) {
    checks.push(`❌ ${name}: ${e.message}`);
  }
}

async function main() {
  // сезон
  await check('ensure_active_season', async () => {
    const { rows } = await db.query(`select number, status, ends_at > now() as alive from ensure_active_season(null)`);
    return `#${rows[0].number} status=${rows[0].status}`;
  });

  // кошелёк: триггер выдал 1000 монет
  await check('кошелёк выдан при регистрации', async () => {
    const { rows } = await db.query(`select w.balance, count(wt.id)::int as txs
      from wallets w join profiles p on p.id = w.user_id
      left join wallet_transactions wt on wt.user_id = w.user_id
      group by w.user_id, w.balance order by w.balance desc limit 1`);
    return `balance=${rows[0].balance}, txs=${rows[0].txs}`;
  });

  // покупка внимания
  await check('purchase_attention', async () => {
    const { rows: u } = await db.query(`select p.id from profiles p join wallets w on w.user_id = p.id
      where w.balance > 200 limit 1`);
    const { rows } = await db.query(`select purchase_attention($1, 'ТЕСТ КРИК ВНИМАНИЯ', 2, 20)`, [u[0].id]);
    const cost = rows[0].purchase_attention.total_cost;
    const { rows: bal } = await db.query(`select balance from wallets where user_id = $1`, [u[0].id]);
    return `cost=${cost}, balance_now=${bal[0].balance}`;
  });

  // недостаточно монет
  await check('purchase_attention без денег (ожидаем ошибку)', async () => {
    const { rows: u } = await db.query(`select p.id from profiles p join wallets w on w.user_id = p.id
      where w.balance < 100 order by w.balance asc limit 1`);
    if (!u.length) return 'нет бедных пользователей, пропуск';
    try {
      await db.query(`select purchase_attention($1, 'НЕТ ДЕНЕГ', 5, 120)`, [u[0].id]);
      return 'ОШИБКА: не упало!';
    } catch (e) {
      return `ожидаемый отказ: ${e.message.slice(0, 60)}`;
    }
  });

  // сохранение своих сообщений
  await check('save_my_message', async () => {
    const { rows: m } = await db.query(`select id, author_id from messages limit 1`);
    await db.query(`select save_my_message($1, $2)`, [m[0].author_id, m[0].id]);
    const { rows: s } = await db.query(`select count(*)::int as c from saved_messages where user_id = $1`, [m[0].author_id]);
    return `saved=${s[0].c}`;
  });

  // сохранение чужого (ожидаем ошибку)
  await check('save_my_message чужого (ожидаем ошибку)', async () => {
    const { rows } = await db.query(
      `select a.id as me, b.id as theirs from profiles a, profiles b where a.id <> b.id limit 1`);
    const { rows: m } = await db.query(`select id from messages where author_id = $1 limit 1`, [rows[0].theirs]);
    try {
      await db.query(`select save_my_message($1, $2)`, [rows[0].me, m[0].id]);
      return 'ОШИБКА: сохранилось чужое!';
    } catch (e) {
      return `ожидаемый отказ: ${e.message.slice(0, 60)}`;
    }
  });

  // daily_reset
  await check('daily_reset', async () => {
    const { rows } = await db.query(`select daily_reset() as res`);
    const r = rows[0].res;
    return `survived=${r.survived}, died=${r.died}`;
  });

  // season_death + next_season
  await check('season_death + next_season', async () => {
    const { rows: d } = await db.query(`select season_death() as res`);
    const { rows: n } = await db.query(`select number, status from next_season(null)`);
    return `умер #${d[0].res.ended_season}, родился #${n[0].number} (${n[0].status})`;
  });

  console.log(checks.join('\n'));
  await db.close?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
