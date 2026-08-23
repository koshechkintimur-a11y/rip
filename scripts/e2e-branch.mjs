/**
 * E2E — ветки переживают смерть root (п.8).
 * A └── B └── C: A умирает → B/C остаются доступны в истории ветки.
 */
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// копия БД, чтобы не трогать рабочий сезон
const src = path.join(root, '.ripdata');
const testDir = path.join(root, '.ripdata-e2e-branch');
fs.rmSync(testDir, { recursive: true, force: true });
fs.cpSync(src, testDir, { recursive: true });

const db = new PGlite(testDir);
let passed = 0, failed = 0;
function check(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

async function main() {
  console.log('Branch survival test\n');

  // активный сезон
  let { rows: [season] } = await db.query(`select * from seasons where status='active' order by number desc limit 1`);
  if (!season) { await db.query(`select ensure_active_season(null)`); ({ rows: [season] } = await db.query(`select * from seasons where status='active' order by number desc limit 1`)); }
  const { rows: [user] } = await db.query(`select id from profiles order by created_at limit 1`);
  const u = user.id;

  // A └── B └── C
  const { rows: [a] } = await db.query(`insert into messages (author_id, season_id, content, status) values ($1,$2,'A-корень','active') returning id`, [u, season.id]);
  const { rows: [b] } = await db.query(`insert into messages (author_id, season_id, content, status, parent_message_id) values ($1,$2,'B-ответ','active',$3) returning id`, [u, season.id, a.id]);
  const { rows: [c] } = await db.query(`insert into messages (author_id, season_id, content, status, parent_message_id) values ($1,$2,'C-ответ','active',$3) returning id`, [u, season.id, b.id]);
  console.log('  ветка: A → B → C');

  // убиваем сезон (A станет dead)
  await db.query(`select death_and_new_season(null)`);

  // A мёртв?
  const { rows: [aNow] } = await db.query(`select status from messages where id=$1`, [a.id]);
  check('корень A стал dead', aNow.status === 'dead', aNow.status);

  // B и C — активны в истории? (они стали dead при смерти сезона тоже — все active→dead)
  const { rows: [bNow] } = await db.query(`select status from messages where id=$1`, [b.id]);
  const { rows: [cNow] } = await db.query(`select status from messages where id=$1`, [c.id]);
  check('B получил финальный статус (не удалён)', bNow.status === 'dead', bNow.status);
  check('C получил финальный статус (не удалён)', cNow.status === 'dead', cNow.status);

  // физически не удалены
  const { rows: allThree } = await db.query(`select count(*)::int as c from messages where id in ($1,$2,$3)`, [a.id, b.id, c.id]);
  check('A,B,C существуют физически (история сохранена)', allThree[0].c === 3, `${allThree[0].c}`);

  // ветка доступна: по id корня достаём цепочку (родитель-ребёнок)
  const { rows: chain } = await db.query(
    `with recursive t as (
       select id, parent_message_id, content, status, created_at from messages where id = $1
       union all
       select m.id, m.parent_message_id, m.content, m.status, m.created_at from messages m join t on m.parent_message_id = t.id
     ) select * from t order by created_at`,
    [a.id]
  );
  check('цепочка A→B→C читается через root', chain.length === 3, `len=${chain.length}`);
  check('B и C в цепочке', chain.some(r => r.content === 'B-ответ') && chain.some(r => r.content === 'C-ответ'));

  // ответ в мёртвую ветку: новый сезон, но parent = C (умерший) — допустимо?
  const { rows: [newSeason] } = await db.query(`select * from seasons where status='active' order by number desc limit 1`);
  const { rows: [d] } = await db.query(`insert into messages (author_id, season_id, content, status, parent_message_id) values ($1,$2,'D-живой-ответ','active',$3) returning id`, [u, newSeason.id, c.id]);
  check('можно ответить в ветку из нового сезона (parent=умерший)', !!d.id);

  // очистка
  await db.query(`delete from messages where content in ('A-корень','B-ответ','C-ответ','D-живой-ответ')`);
  console.log('  тестовая ветка очищена');

  console.log(`\nИтог ветки: ${passed} ✅ / ${failed} ❌`);
  await db.close();
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error('Тест упал:', e); process.exit(1); });
