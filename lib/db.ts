import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

type Queryable = {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close?(): Promise<void>;
};

const g = globalThis as unknown as { __ripDb?: Queryable };

/** Next.js 15.5+ в dev возвращает process.cwd() как URL — нормализуем в путь. */
export function getCwd(): string {
  const cwd = process.cwd();
  if (typeof cwd === 'string') return cwd;
  if (typeof cwd === 'object' && cwd !== null) {
    // Next 15.5 dev может возвращать URL-объект
    const url = cwd as URL;
    if (url.href && url.href.startsWith('file://')) {
      return decodeURIComponent(url.pathname.replace(/^\/([a-zA-Z]:)/, '$1'));
    }
  }
  return String(cwd);
}

function getDb(): Queryable {
  if (g.__ripDb) return g.__ripDb;

  const url = process.env.DATABASE_URL;
  if (url) {
    g.__ripDb = new Pool({ connectionString: url, max: 10 });
  } else {
    // Локальная разработка без внешнего Postgres: PGlite (WASM-постгрес) в ./.ripdata
    const cwd: unknown = process.cwd();
    const dir = path.join(getCwd(), '.ripdata');
    console.log('[db] cwd typeof=', typeof cwd, 'isURL=', cwd instanceof URL, 'dir=', dir);
    fs.mkdirSync(dir, { recursive: true });
    g.__ripDb = new PGlite(dir);
  }
  return g.__ripDb;
}

/** Выполнить запрос, вернуть строки */
export async function q<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await getDb().query<T>(text, params);
  return res.rows;
}

/** Одна строка или null */
export async function qOne<T = any>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Много-стейтментный SQL (миграции). Только для PGlite / single-connection. */
export async function execSql(sql: string): Promise<void> {
  const db = getDb();
  if (db instanceof PGlite) {
    await (db as any).exec(sql);
  } else {
    await (db as Pool).query(sql);
  }
}

export function getDbInstance() {
  return getDb();
}
