/**
 * E2E — death + refresh (п.26).
 * Сезон → смерть → YOU RIP → refresh → новый сезон, не старый.
 * Работает на копии БД, не трогает рабочий сезон.
 */
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, '.ripdata');
const testDir = path.join(root, '.ripdata-e2e-death');
fs.rmSync(testDir, { recursive: true, force: true });
fs.cpSync(src, testDir, { recursive: true });

const db = new PGlite(testDir);
let passed = 0, failed = 0;
function check(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

async function main() {
  console.log('Death + Refresh test\n');

  // 1. Активный сезон
  const { rows: [before] } = await db.query(`select * from seasons where status='active' order by number desc limit 1`);
  if (!before) { await db.query(`select ensure_active_season(null)`); }
  const { rows: [s1] } = await db.query(`select * from seasons where status='active' order by number desc limit 1`);
  console.log(`  активный: СЕЗОН #${s1.number} (${s1.status})`);

  const { rows: [user] } = await db.query(`select id from profiles order by created_at limit 1`);
  const u = user.id;

  // 2. Сообщение в ленте
  await db.query(`insert into messages (author_id, season_id, content, status) values ($1,$2,'сообщение перед смертью','active')`, [u, s1.id]);

  // 3. Смерть
  const { rows: [death] } = await db.query(`select death_and_new_season(null) as res`);
  console.log('  смерть:', JSON.stringify(death.res));

  // 4. Проверка: старый ended, новый active
  const { rows: [oldSeason] } = await db.query(`select * from seasons where id = $1`, [s1.id]);
  check('старый сезон ended', oldSeason.status === 'ended', oldSeason.status);

  const { rows: [newSeason] } = await db.query(`select * from seasons where status='active' order by number desc limit 1`);
  check('новый сезон created', !!newSeason, 'нет active');
  if (newSeason) {
    check('новый номер = старый + 1', newSeason.number === s1.number + 1, `#${newSeason.number} vs #${s1.number}`);
    check('новый id ≠ старый', newSeason.id !== s1.id);
  }

  // 5. /api/state аналог: ensure_active_season возвращает НОВЫЙ
  const { rows: [birth] } = await db.query(`select * from ensure_active_season(null)`);
  check('ensure вернул ACTIVE', birth.status === 'active', birth.status);
  check('ensure вернул НОВЫЙ (не старый)', birth.id !== s1.id, `id=${birth.id}`);

  // 6. Feed нового сезона пуст
  const { rows: [feed] } = await db.query(
    `select count(*)::int as c from messages where season_id = $1 and status in ('active','legendary')`,
    [newSeason.id]
  );
  check('feed нового сезона пуст', feed.c === 0, `сообщений: ${feed.c}`);

  // 7. Старый сезон имеет историю (сообщение не удалено)
  const { rows: [hist] } = await db.query(
    `select count(*)::int as c from messages where season_id = $1 and status = 'dead'`,
    [s1.id]
  );
  check('старый сезон хранит историю (dead сообщения)', hist.c >= 1, `dead: ${hist.c}`);

  // 8. Refresh-симуляция: новый GET /api/state должен вернуть новый сезон
  //    (имитация refresh: снова query active)
  const { rows: [afterRefresh] } = await db.query(`select * from seasons where status='active' order by number desc limit 1`);
  check('refresh: активный сезон = новый', afterRefresh.id !== s1.id);
  check('refresh: номер = новый', afterRefresh.number === s1.number + 1);

  // очистка
  await db.query(`delete from messages where content like 'сообщение перед смертью'`);
  console.log('  очищено');

  console.log(`\nИтог death+refresh: ${passed} ✅ / ${failed} ❌`);
  await db.close();
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });