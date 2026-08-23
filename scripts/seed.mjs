/**
 * RIP seed — демо-данные.
 * Использование: node scripts/seed.mjs
 * Создаёт: 12 демо-пользователей (пароль ripdemo123), сезон,
 * ~90 сообщений с ответами, attention-слоты, системные события.
 */
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import crypto from 'crypto';
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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const USERS = [
  ['timur', 'Тимур'], ['anna', 'Аня'], ['max', 'Макс'], ['oleg', 'Олег'],
  ['dasha', 'Даша'], ['kirill', 'Кирилл'], ['vika', 'Вика'], ['pasha', 'Паша'],
  ['lera', 'Лера'], ['grisha', 'Гриша'], ['sofia', 'София'], ['roma', 'Рома'],
];

const MESSAGES = [
  'кто не спит?', 'я', 'завтра собеседование', 'опять понедельник',
  'кофе или смерть', 'смотрю как лента умирает и мне норм', 'у кого-нибудь было такое что сообщение выжило?',
  '3 reset подряд живое, я в шоке', 'моё первое сообщение умерло сразу', 'F',
  'пермь кто нибудь есть?', 'тут вообще из Питера есть?', 'казань на связи',
  'не спится', 'работаю удалённо уже год, начинаю забывать как выглядит солнце',
  'купил слот внимания ради эксперимента, привет всем', 'ЭТО МОЁ СООБЩЕНИЕ ВИДЯТ ВСЕ',
  'аааааа', 'АААААААА', 'проверка связи', 'как дела у мёртвых сообщений',
  'если ты это читаешь — ты тоже часть эксперимента', 'лента сегодня тихая',
  'дождь опять', 'чайник сломался, пью кипяток', 'кот наступил на ноут и отправил это: jjjjjjjjj',
  'jjjjjjjjjj', 'извините за кота', 'кто-нибудь знает когда reset', 'страшно за свои сообщения',
  'мой самый старый пост всё ещё живой, растём', 'легендарное сообщение видели? оно с первого дня',
  'внимание — самая твёрдая валюта здесь', 'продаю душу за 20 монет',
  'когда сезон умрёт я не буду грустить', 'буду', 'ладно немного буду',
  'все спят а я пишу в пустоту', 'пустота отвечает', 'это красиво если подумать',
  'наш чат умрёт и никто не вспомнит', 'я запомню', 'спасибо', '❤️',
  'утро всех', 'доброе', 'что бы написать чтобы выжило', 'искренность работает',
  'правда?', 'правда', 'проверим', 'вот моё честное сообщение: мне одиноко иногда',
  'держись', 'обнял', 'спасибо, стало легче', 'тут неожиданно тепло',
  'лента живее чем моя жизнь', 'грустно но прикольно', 'ещё один круг по ленте и спать',
  'кто-нибудь пробовал сохранить сообщение в архив?', 'да, 3 штуки максимум за сезон',
  'жадничайте меньше сохраняйте больше', 'философия RIP: отпусти', 'отпускаю',
  'не отпускается', 'попробуй ещё раз завтра', 'завтра может не быть для моего сообщения',
  'вот это поворот', 'камбэк', 'живое', 'мёртвое', 'RIP',
  'первый сезон почти кончен да?', 'осталось меньше суток вроде',
  'успейте написать что-то важное', 'важное: спасибо всем кто был рядом',
  'до встречи в следующем сезоне', 'мы вернёмся', 'мы всегда возвращаемся',
  'последнее сообщение сезона (нет)', '(да)', '(спорим)', '(принято)',
];

const ATTENTION = [
  ['timur', 'КТО НЕ СПИТ?'],
  ['anna', 'Я КУПИЛА 5 МЕСТ'],
  ['max', 'АААААА'],
  ['oleg', 'кто из Перми?'],
  ['vika', 'ЗДЕСЬ БЫЛО ВНИМАНИЕ'],
  ['kirill', 'ЗАПЛАТИ И УВИДИШЬ МЕНЯ'],
];

async function main() {
  const { rows: existing } = await db.query(`select id from seasons limit 1`);
  let seasonId;
  if (existing.length > 0) {
    seasonId = existing[0].id;
    console.log('Сезон уже существует:', seasonId);
  } else {
    const { rows: s } = await db.query(`select * from ensure_active_season(604800)`);
    seasonId = s[0].id;
    console.log('Создан сезон:', seasonId);
  }

  // --- пользователи ---
  const ids = {};
  for (const [username, displayName] of USERS) {
    const email = `${username}@rip.demo`;
    const { rows: existingU } = await db.query(`select id from profiles where username = $1`, [username]);
    if (existingU.length > 0) {
      ids[username] = existingU[0].id;
      continue;
    }
    const { rows: u } = await db.query(
      `insert into users (email, password_hash) values ($1, $2) returning id`,
      [email, hashPassword('ripdemo123')]
    );
    await db.query(
      `insert into profiles (id, username, display_name, is_test_user) values ($1, $2, $3, true)`,
      [u[0].id, username, displayName]
    );
    ids[username] = u[0].id;
  }
  console.log('Пользователей:', Object.keys(ids).length);

  // --- сообщения ---
  const usernames = Object.keys(ids);
  const rootIds = [];
  let n = 0;
  for (let i = 0; i < MESSAGES.length; i++) {
    const author = usernames[i % usernames.length];
    const createdAt = new Date(Date.now() - (MESSAGES.length - i) * 7 * 60 * 1000).toISOString();
    let parent = null;
    if (rootIds.length > 2 && i % 9 === 4) {
      parent = rootIds[Math.floor(Math.random() * rootIds.length)];
    }
    const { rows: m } = await db.query(
      `insert into messages (author_id, season_id, content, status, parent_message_id, created_at)
       values ($1, $2, $3, 'active', $4, $5) returning id`,
      [ids[author], seasonId, MESSAGES[i], parent, createdAt]
    );
    if (!parent) rootIds.push(m[0].id);
    n++;
  }

  // ответы в случайные ветки
  const { rows: roots } = await db.query(
    `select id from messages where season_id = $1 and parent_message_id is null limit 20`, [seasonId]
  );
  for (let r = 0; r < Math.min(6, roots.length); r++) {
    for (let k = 0; k < 2 + (r % 3); k++) {
      const author = usernames[(r * 3 + k) % usernames.length];
      await db.query(
        `insert into messages (author_id, season_id, content, parent_message_id, created_at)
         values ($1, $2, $3, $4, $5)`,
        [ids[author], seasonId, MESSAGES[(r * 5 + k) % MESSAGES.length], roots[r].id,
         new Date(Date.now() - (60 - r) * 60000).toISOString()]
      );
    }
  }

  // легендарные и погибшие для истории
  const { rows: someMsgs } = await db.query(`select id from messages where season_id = $1 limit 8`, [seasonId]);
  if (someMsgs.length >= 6) {
    await db.query(
      `update messages set status = 'legendary', survival_count = 6, last_survived_at = now() where id = any($1)`,
      [someMsgs.slice(0, 3).map((m) => m.id)]
    );
    await db.query(
      `update messages set status = 'dead', died_at = now() where id = any($1)`,
      [someMsgs.slice(3, 6).map((m) => m.id)]
    );
  }

  // --- attention ---
  const now = Date.now();
  for (let pos = 0; pos < ATTENTION.length; pos++) {
    const [username, text] = ATTENTION[pos];
    if (!ids[username]) continue;
    await db.query(
      `insert into attention_slots (user_id, content, position, starts_at, ends_at, price, status)
       values ($1, $2, $3, $4, $5, 20, $6)`,
      [ids[username], text, pos,
       new Date(now + pos * 10 * 60 * 1000).toISOString(),
       new Date(now + (pos + 1) * 10 * 60 * 1000).toISOString(),
       pos === 0 ? 'active' : 'scheduled']
    );
  }

  // --- системные события ---
  await db.query(
    `insert into system_events (season_id, kind, content) values
     ($1, 'reset_done', '🟢 RESET ЗАВЕРШЁН. 41 выжил. 39 погибли.'),
     ($1, 'season_warning', '⚠️ До конца сезона осталось меньше суток.')`,
    [seasonId]
  );

  console.log(`Готово: ${n} сообщений, ${ATTENTION.length} attention-слотов. Демо-пароль: ripdemo123`);
  await db.close?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
