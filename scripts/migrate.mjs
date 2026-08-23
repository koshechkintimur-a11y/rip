/**
 * Применяет SQL-миграции из db/.
 * Без DATABASE_URL использует локальный PGlite в ./.ripdata.
 * Использование: node scripts/migrate.mjs
 */
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const url = process.env.DATABASE_URL;
let db;
if (url) {
  db = new Pool({ connectionString: url });
} else {
  db = new PGlite(path.join(root, '.ripdata'));
}

async function main() {
  await db.exec(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())`);
  const { rows } = await db.query(`select name from schema_migrations`);
  const applied = new Set(rows.map((r) => r.name));

  const dir = path.join(root, 'db');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => {
    // schema.sql — базовая схема, применяется ПЕРВОЙ; остальные — по номеру
    if (a === 'schema.sql') return -1;
    if (b === 'schema.sql') return 1;
    return a.localeCompare(b);
  });

  for (const f of files) {
    if (applied.has(f)) { console.log(`skip  ${f}`); continue; }
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log(`apply ${f} ...`);
    await db.exec('begin');
    try {
      await db.exec(sql);
      await db.query(`insert into schema_migrations (name) values ($1)`, [f]);
      await db.exec('commit');
      console.log('  ok');
    } catch (e) {
      await db.exec('rollback');
      console.error(`FAIL ${f}:`, e.message);
      process.exit(1);
    }
  }
  console.log('Миграции применены.');
  await db.close?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
