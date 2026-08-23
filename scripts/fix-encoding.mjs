import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const db = new PGlite(path.join(root, '.ripdata'));

async function main() {
  const { rows: badMsg } = await db.query(`select id from messages where content like '%\ufffd%'`);
  if (badMsg.length > 0) {
    await db.query(`delete from messages where id = any($1)`, [badMsg.map((r) => r.id)]);
    console.log('удалено битых сообщений:', badMsg.length);
  } else {
    console.log('битых сообщений нет');
  }
  // проверка чистоты attention
  const { rows: attn } = await db.query(`select content from attention_slots where content like '%\ufffd%'`);
  console.log('битых слотов осталось:', attn.length);
  await db.close();
}
main();