import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const db = new PGlite(path.join(root, '.ripdata'));

async function main() {
  await db.query(`alter table messages add column if not exists last_seen_at timestamptz`);
  await db.query(`alter table messages add column if not exists repost_of_id uuid references messages(id) on delete set null`);
  await db.query(`create index if not exists idx_messages_repost_of on messages(repost_of_id)`);
  console.log('Добавлены колонки: last_seen_at, repost_of_id');
  await db.close();
}
main();