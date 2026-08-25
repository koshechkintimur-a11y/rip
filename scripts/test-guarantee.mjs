// Тест гарантии «мир помнит» (миграция 0013):
// юзер с 5 постами — даже если все выпали на смерть, один обязан выжить
const BASE = 'http://localhost:3002';
const api = async (path, opts = {}, cookie) => {
  const r = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) } });
  return r.json();
};
const mk = async (u) => {
  const r = await fetch(BASE + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${u}@t.ru`, password: 'qa12345', confirmPassword: 'qa12345', username: u }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
};

(async () => {
  const adminLogin = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'timur@rip.demo', password: 'ripdemo123' }) });
  const cAdmin = (adminLogin.headers.get('set-cookie') || '').split(';')[0];

  const ts = Date.now().toString().slice(-5);
  const cU = await mk('gu_' + ts);   // юзер с 5 постами БЕЗ черепков (шанс 30% у всех)
  console.log('юзер создан');

  const post = async (c, content) => {
    const r = await api('/api/messages', { method: 'POST', body: JSON.stringify({ content }) }, c);
    if (!r.message) throw new Error('post failed: ' + JSON.stringify(r));
    return r.message;
  };
  const ids = [];
  for (let i = 0; i < 5; i++) {
    ids.push((await post(cU, 'гарантия-пост-' + i)).id);
  }
  console.log('5 постов создано (все без черепков, шанс 30%)');

  // ждём, если прошло <60с с прошлой волны
  const waitFor = async (ms) => new Promise(r => setTimeout(r, ms));
  console.log('запуск волны (может ждать 60с лимит)...');
  const reset = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }, cAdmin);
  if (reset.error) { console.log('ошибка:', reset.error); await waitFor(65000); }
  const reset2 = reset.error ? await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }, cAdmin) : reset;
  console.log('reset:', JSON.stringify(reset2).slice(0, 90));

  const feed = await api('/api/feed?limit=20', {}, cU);
  const alive = ids.map(id => feed.items.find(i => i.id === id)).filter(i => i && i.status !== 'dead');
  const dead = ids.map(id => feed.items.find(i => i.id === id)).filter(i => i && i.status === 'dead');
  console.log(`после волны: живы=${alive.length} погибли=${dead.length}`);
  console.log(alive.length >= 1 ? '✓ ГАРАНТИЯ РАБОТАЕТ: минимум 1 пост выжил' : '✗ ВСЕ ПОГИБЛИ — гарантия не сработала');
})();
