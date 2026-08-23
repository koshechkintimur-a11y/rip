import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const db = new PGlite(path.join(root, '.ripdata'));

async function main() {
  const { rows: seasons } = await db.query('select number, status from seasons order by number desc limit 3');
  console.log('seasons:', JSON.stringify(seasons));

  const { rows: msgs } = await db.query(
    'select season_id, status, count(*)::int as c from messages group by season_id, status order by season_id desc limit 8'
  );
  console.log('msgs:', JSON.stringify(msgs));

  const { rows: roots } = await db.query(
    'select count(*)::int as c from messages where parent_message_id is null and season_id = (select id from seasons order by number desc limit 1)'
  );
  console.log('roots in latest:', JSON.stringify(roots));

  const { rows: feed } = await db.query(
    `select m.id, m.content, m.parent_message_id, p.username
     from messages m join profiles p on p.id = m.author_id
     where m.season_id = (select id from seasons order by number desc limit 1)
       and m.parent_message_id is null
     order by m.created_at desc limit 5`
  );
  console.log('feed roots:', JSON.stringify(feed));

  await db.close();
}
main();