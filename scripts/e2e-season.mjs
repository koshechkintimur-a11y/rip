/**
 * E2E — season lifecycle acceptance test.
 * Сценарий: active сезон → смерть → финализация → новый активный сезон.
 * Проверяет: status'ы сообщений, отсутствие дублирования, refresh не возвращает старый сезон.
 */
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// РАБОТАЕМ НА КОПИИ БД, чтобы не убить рабочий сезон
import fs from 'fs';
const src = path.join(root, '.ripdata');
const testDir = path.join(root, '.ripdata-e2e-season');
fs.rmSync(testDir, { recursive: true, force: true });
fs.cpSync(src, testDir, { recursive: true });

const db = new PGlite(testDir);

let passed = 0, failed = 0;
function check(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

async function main() {
  console.log('Season lifecycle test\n');

  // --- 0. Состояние до: активный сезон существует? Если нет — создать ---
  let { rows: [s0] } = await db.query(`select * from seasons where status = 'active' order by number desc limit 1`);
  if (!s0) {
    await db.query(`select ensure_active_season(null)`);
    ({ rows: [s0] } = await db.query(`select * from seasons where status = 'active' order by number desc limit 1`));
  }
  const seasonId = s0.id;
  const seasonNum = s0.number;
  console.log(`До смерти: СЕЗОН #${seasonNum} (${s0.status})`);

  // --- 1. Создаём тестовые сообщения: 10 active + 3 dead + 2 legendary ---
  const { rows: [user] } = await db.query(`select id from profiles order by created_at limit 1`);
  const u = user.id;
  const msgIds = [];
  for (let i = 0; i < 10; i++) {
    const { rows: [m] } = await db.query(
      `insert into messages (author_id, season_id, content, status) values ($1, $2, $3, 'active') returning id`,
      [u, seasonId, `lifecycle-test-active-${i}`]
    );
    msgIds.push(m.id);
  }
  const deadIds = [];
  for (let i = 0; i < 3; i++) {
    const { rows: [m] } = await db.query(
      `insert into messages (author_id, season_id, content, status, died_at) values ($1, $2, $3, 'dead', now()) returning id`,
      [u, seasonId, `lifecycle-test-dead-${i}`]
    );
    deadIds.push(m.id);
  }
  const legIds = [];
  for (let i = 0; i < 2; i++) {
    const { rows: [m] } = await db.query(
      `insert into messages (author_id, season_id, content, status, survival_count) values ($1, $2, $3, 'legendary', 6) returning id`,
      [u, seasonId, `lifecycle-test-legend-${i}`]
    );
    legIds.push(m.id);
  }
  console.log('  создано: 10 active, 3 dead, 2 legendary');

  // --- 2. Смерть сезона ---
  const { rows: [deathRes] } = await db.query(`select death_and_new_season(null) as res`);
  console.log('  смерть:', JSON.stringify(deathRes.res));

  // --- 3. Проверки ---
  // 3.1 старый сезон ended
  const { rows: [oldSeason] } = await db.query(`select * from seasons where id = $1`, [seasonId]);
  check('СЕЗОН #' + seasonNum + ' стал ended', oldSeason.status === 'ended', oldSeason.status);

  // 3.2 сообщения: active → dead
  const { rows: activeCount } = await db.query(`select count(*)::int as c from messages where id = any($1) and status = 'active'`, [msgIds]);
  check('active сообщения переведены в dead (0 active)', activeCount[0].c === 0, `осталось active: ${activeCount[0].c}`);

  const { rows: deadNow } = await db.query(`select count(*)::int as c from messages where id = any($1) and status = 'dead'`, [msgIds]);
  check('10 бывших active стали dead', deadNow[0].c === 10, `dead: ${deadNow[0].c}`);

  // 3.3 legendary сохранились
  const { rows: legNow } = await db.query(`select count(*)::int as c from messages where id = any($1) and status = 'legendary'`, [legIds]);
  check('2 legendary сохранились', legNow[0].c === 2, `legendary: ${legNow[0].c}`);

  // 3.4 dead остались dead
  const { rows: deadKept } = await db.query(`select count(*)::int as c from messages where id = any($1) and status = 'dead'`, [deadIds]);
  check('3 dead остались dead', deadKept[0].c === 3, `dead: ${deadKept[0].c}`);

  // 3.5 новый сезон создан
  const { rows: [newSeason] } = await db.query(`select * from seasons where status = 'active' order by number desc limit 1`);
  check('новый сезон создан и активен', !!newSeason, 'нет active сезона!');
  if (newSeason) {
    check('новый season.id != старого', newSeason.id !== seasonId, newSeason.id);
    check('новый номер = старый + 1', newSeason.number === seasonNum + 1, `#${newSeason.number} vs #${seasonNum}+1`);
  }

  // 3.6 feed нового сезона не содержит старые сообщения
  const { rows: feedCount } = await db.query(
    `select count(*)::int as c from messages where season_id = $1 and status in ('active','legendary')`,
    [newSeason ? newSeason.id : seasonId]
  );
  check('новый сезон начинается с пустого мира', feedCount[0].c === 0, `сообщений: ${feedCount[0].c}`);

  // 3.7 ensureWorldBirth не возвращает ended
  const { rows: [birth] } = await db.query(`select * from ensure_active_season(null)`);
  check('ensure_active_season вернул ACTIVE', birth.status === 'active', birth.status);
  check('ensure вернул НОВЫЙ сезон (не старый)', birth.id !== seasonId);

  // --- 4. Очистка тестовых данных (чтобы не мусорить в историю) ---
  await db.query(`delete from messages where content like 'lifecycle-test-%'`);
  console.log('  тестовые сообщения очищены');

  console.log(`\nИтог lifecycle: ${passed} ✅ / ${failed} ❌`);
  await db.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Тест упал:', e); process.exit(1); });
