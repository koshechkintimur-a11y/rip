import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const db = new PGlite(path.join(root, '.ripdata'));

async function main() {
  // удалить старые репосты (с дублированным контентом)
  const { rows } = await db.query(
    `delete from messages where repost_of_id is not null and content <> ''
     returning id`
  );
  console.log(`Удалено старых репостов: ${rows.length}`);
  await db.close();
}
main();