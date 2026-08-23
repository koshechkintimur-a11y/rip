import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const db = new PGlite(path.join(root, '.ripdata'));

async function main() {
  const { rows: season } = await db.query(
    "select id from seasons where status = 'active' order by number desc limit 1"
  );
  const sid = season[0].id;
  console.log('active season:', sid);

  // точный запрос feed
  const { rows: items } = await db.query(
    `select
       'message' as type, m.id, m.content, m.media_url, m.media_type, m.status,
       m.survival_count::int, m.reaction_count::int, m.created_at, m.author_id,
       p.username, p.display_name, m.branch_id,
       (select b.reply_count from branches b where b.root_message_id = m.id) as reply_count,
       null::text as event_kind
     from messages m join profiles p on p.id = m.author_id
     where m.season_id = $1 and m.parent_message_id is null
       and m.status in ('active','legendary')
     order by m.created_at desc
     limit 10`,
    [sid]
  );
  console.log('feed rows:', items.length);
  console.log(JSON.stringify(items.slice(0, 3), null, 1));
  await db.close();
}
main();