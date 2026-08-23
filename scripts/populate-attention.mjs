/**
 * Наполнение ленты внимания тестовыми слотами (UTF-8 из Node, без кракозябр).
 * Использование: node scripts/populate-attention.mjs
 */
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const url = process.env.DATABASE_URL;
let db = url ? new Pool({ connectionString: url }) : new PGlite(path.join(root, '.ripdata'));

const SLOTS = [
  ['timur', 'КТО НЕ СПИТ?'],
  ['anna', 'Я КУПИЛА 5 МЕСТ'],
  ['max', 'АААААА'],
  ['oleg', 'кто из Перми?'],
  ['vika', 'ЗДЕСЬ БЫЛО ВНИМАНИЕ'],
  ['kirill', 'ЗАПЛАТИ И УВИДИШЬ МЕНЯ'],
  ['dasha', 'СЕГОДНЯ РЕСЕТ — ВСЕМ ГОТОВИТЬСЯ'],
  ['pasha', 'ЭТО САМОЕ ДОРОГОЕ СООБЩЕНИЕ В МОЕЙ ЖИЗНИ'],
];

async function main() {
  const { rows: seasons } = await db.query(
    `select id, number from seasons where status = 'active' order by number desc limit 1`
  );
  if (seasons.length === 0) { console.error('Нет активного сезона'); process.exit(1); }
  const seasonId = seasons[0].id;

  const { rows: users } = await db.query(`select id, username from profiles`);
  const byName = Object.fromEntries(users.map((u) => [u.username, u.id]));

  const { rows: existing } = await db.query(
    `select count(*)::int as c from attention_slots where ends_at > now() and status in ('active','scheduled')`
  );
  if (existing[0].c > 0) {
    console.log(`Уже есть ${existing[0].c} активных слотов — пропускаю`);
    await db.close?.();
    return;
  }

  const now = Date.now();
  let pos = 0;
  for (const [username, text] of SLOTS) {
    const uid = byName[username];
    if (!uid) { console.warn('нет юзера', username); continue; }
    await db.query(
      `insert into attention_slots (user_id, content, position, starts_at, ends_at, price, status)
       values ($1, $2, $3, $4, $5, 20, $6)`,
      [uid, text, pos,
       new Date(now + pos * 10 * 60000).toISOString(),
       new Date(now + (pos + 1) * 10 * 60000).toISOString(),
       pos === 0 ? 'active' : 'scheduled']
    );
    pos++;
  }
  console.log(`Добавлено ${pos} слотов внимания в сезон #${seasons[0].number}`);
  await db.close?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
