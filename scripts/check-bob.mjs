import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const db = new PGlite(path.join(root, '.ripdata'));

async function main() {
  const { rows: u } = await db.query(
    `select u.email, p.username, p.display_name, p.is_test_user, p.created_at,
            w.balance,
            (select count(*) from messages m where m.author_id = p.id)::int as msgs,
            (select count(*) from direct_messages dm where dm.sender_id = p.id)::int as dms
     from users u
     join profiles p on p.id = u.id
     left join wallets w on w.user_id = p.id
     where p.username = 'bob'`
  );
  console.log(JSON.stringify(u, null, 1));
  await db.close();
}
main();