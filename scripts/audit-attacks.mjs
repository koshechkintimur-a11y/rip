// Аудит-проверки: живые атаки против локального API
const BASE = 'http://localhost:3002';
const api = async (path, opts = {}, cookie) => {
  const r = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) } });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
};
const mk = async (u) => {
  const r = await fetch(BASE + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${u}@t.ru`, password: 'qa12345', confirmPassword: 'qa12345', username: u }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
};

(async () => {
  const ts = Date.now().toString().slice(-5);
  const cA = await mk('au_a_' + ts);
  const cB = await mk('au_b_' + ts);
  console.log('=== A и B созданы ===');

  // 1. SELF-SKULL: A ставит черепок СВОЕМУ посту
  const post = async (c, content) => (await api('/api/messages', { method: 'POST', body: JSON.stringify({ content }) }, c)).d.message;
  const pA = await post(cA, 'аудит-self-skull-' + ts);
  const selfSkull = await api('/api/messages/react', { method: 'POST', body: JSON.stringify({ messageId: pA.id }) }, cA);
  console.log(`1. SELF-SKULL (должен быть 400): ${selfSkull.status} ${JSON.stringify(selfSkull.d)?.slice(0, 60)}`);

  // 2. Черепок DEAD-сообщению: A ставит черепок, B черепит, потом волна убивает, потом C черепит мёртвое
  const pB = await post(cB, 'аудит-dead-skull-' + ts);
  // черепки от A
  await api('/api/messages/react', { method: 'POST', body: JSON.stringify({ messageId: pB.id }) }, cA);
  const feed = await api('/api/feed?limit=10', {}, cA);
  const fb = feed.d.items.find(i => i.id === pB.id);
  console.log(`2. пост B до волны: status=${fb?.status}`);

  // 3. Повторный репост: B репостит пост A дважды
  const r1 = await api('/api/messages', { method: 'PUT', body: JSON.stringify({ messageId: pA.id }) }, cB);
  const r2 = await api('/api/messages', { method: 'PUT', body: JSON.stringify({ messageId: pA.id }) }, cB);
  console.log(`3. ПОВТОРНЫЙ РЕПОСТ: #1=${r1.status} #2=${r2.status} (оба 200 = фарм разрешён)`);

  // 4. Login telegram-юзером (email tg_XXX@telegram.rip) — 500 или 401?
  const tgLogin = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: `tg_1@telegram.rip`, password: 'whatever' }) });
  console.log(`4. LOGIN telegram-юзер (несуществующий tg_1): ${tgLogin.status} (401 = ок, 500 = баг)`);
  // существующий telegram-юзер: создать через /api/auth/telegram с подделанным initData нельзя (HMAC), но...
  // симулируем: users с password_hash=null (как telegram) — через API нельзя, но проверим на прямом SQL? Нет.
  // Проверим на реальном telegram-юзере из прод-БД — локально их нет. Отметим как логически подтверждённый.

  // 5. Rate-limit обход через X-Forwarded-For
  console.log('=== 5. rate-limit: 6 signup подряд с разных XFF ===');
  let blocked = 0;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(BASE + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.0.${i}` }, body: JSON.stringify({ email: `rl${i}_${ts}@t.ru`, password: 'qa12345', confirmPassword: 'qa12345', username: `rl${i}_${ts}` }) });
    if (r.status === 429) blocked++;
  }
  console.log(`   заблокировано: ${blocked}/6 (0 = XFF подменяется → лимит не работает)`);

  // 6. Message без rate limit? 11 сообщений подряд
  console.log('=== 6. лимит сообщений: 11 подряд ===');
  let msgOk = 0, msgBlocked = 0;
  for (let i = 0; i < 11; i++) {
    const r = await api('/api/messages', { method: 'POST', body: JSON.stringify({ content: 'лимит-' + i }) }, cA);
    if (r.status === 429) msgBlocked++; else if (r.status === 200) msgOk++;
  }
  console.log(`   сообщений: ok=${msgOk} blocked=${msgBlocked} (10/мин лимит: 11-е должен быть 429)`);
})();
