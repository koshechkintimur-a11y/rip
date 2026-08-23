/**
 * Наполнение ТЕКУЩЕГО активного сезона тестовыми сообщениями и ветками.
 * Использование: node scripts/populate.mjs
 * Создаёт ~20 корней + ответы в них (для проверки веток/дискуссий).
 */
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const url = process.env.DATABASE_URL;
let db = url ? new Pool({ connectionString: url }) : new PGlite(path.join(root, '.ripdata'));

const THREADS = [
  ['timur', 'куда сходить в Перми?', [
    'музей современного искусства, там экспозиция про смерть, кстати',
    'набережная к вечеру огонь',
    'а я из Перми и не знал, что тут есть музей',
    'сходите на завод Шпагина, лучший лофт города',
  ]],
  ['anna', 'как пережить reset? дайте совет', [
    'пиши искренне — такие выживают чаще',
    'не пиши в первые 10 минут после ресета, там чистка',
    'моё первое сообщение умерло, но я не сдался',
    'совет: сохраняй лучшее в архив заранее',
  ]],
  ['max', 'продам душу за 5 монет', [
    'беру, но только с доставкой',
    'а слот внимания в подарок?',
    'душа уже мертва, не обманывай людей',
    'торг уместен: 3 монеты и рукопожатие',
  ]],
  ['oleg', 'почему никто не пишет в 3 часа ночи?', [
    'все умерли в ресете',
    'я пишу, я живой',
    '3 ночи — время легендарных сообщений',
    'потому что все спят, как нормальные люди',
  ]],
  ['vika', 'мой пост пережил 3 ресета, я в шоке', [
    'поздравляю! до легендарного осталось 2',
    'какой текст? хочу такой же',
    'это знак, ты избранный',
    'держи, пригодится: ⭐',
  ]],
  ['kirill', 'кто из Казани?', [
    'я! привет земляку',
    'казань на связи 🏙️',
    'а я из Питера, но кайфую от Казани',
    'не из Казани, но был там — красиво',
  ]],
];

async function main() {
  const { rows: seasons } = await db.query(
    `select * from seasons where status = 'active' order by number desc limit 1`
  );
  if (seasons.length === 0) {
    console.error('Нет активного сезона. Сначала: node scripts/seed.mjs или открой приложение.');
    process.exit(1);
  }
  const seasonId = seasons[0].id;

  const { rows: users } = await db.query(`select id, username from profiles`);
  const byName = Object.fromEntries(users.map((u) => [u.username, u.id]));

  let roots = 0;
  let replies = 0;

  for (const [author, text, answers] of THREADS) {
    const aid = byName[author];
    if (!aid) { console.warn('нет юзера', author); continue; }

    const createdAt = new Date(Date.now() - (roots * 5 + 3) * 60 * 1000).toISOString();
    const { rows: m } = await db.query(
      `insert into messages (author_id, season_id, content, status, created_at)
       values ($1, $2, $3, 'active', $4) returning id`,
      [aid, seasonId, text, createdAt]
    );
    roots++;

    for (let i = 0; i < answers.length; i++) {
      const a = users[Math.floor(Math.random() * users.length)];
      await db.query(
        `insert into messages (author_id, season_id, content, parent_message_id, created_at)
         values ($1, $2, $3, $4, $5)`,
        [a.id, seasonId, answers[i], m[0].id, new Date(Date.now() - (i + 1) * 2 * 60 * 1000).toISOString()]
      );
      replies++;
    }
  }

  console.log(`Готово: ${roots} веток, ${replies} ответов в сезон #${seasons[0].number}`);
  await db.close?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
