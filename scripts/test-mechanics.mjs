// Тест механики выживания (миграция 0013) — 2-й прогон:
// шанс от черепков (5 разных юзеров), новичковый буст, гарантия «мир помнит»
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
  const cA = await mk('ma_' + ts);
  // 5 разных юзеров для черепков
  const reactors = [];
  for (let i = 0; i < 5; i++) reactors.push(await mk('mr' + i + '_' + ts));
  console.log('юзеры: A + 5 реакторов ✓');

  const post = async (c, content) => (await api('/api/messages', { method: 'POST', body: JSON.stringify({ content }) }, c)).message;
  const p1 = await post(cA, 'механика-тест-черепки');
  const p2 = await post(cA, 'механика-тест-без-черепков');
  console.log('посты созданы');

  // 5 черепков от 5 разных юзеров на p1
  for (const c of reactors) {
    await fetch(BASE + '/api/messages/react', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify({ messageId: p1.id }) });
  }
  console.log('5 черепков поставлено');

  const feed = await api('/api/feed?limit=20', {}, cA);
  const f1 = feed.items.find(i => i.id === p1.id);
  const f2 = feed.items.find(i => i.id === p2.id);
  const ch = (it) => Math.round(Math.min(Math.max(0.3 + (it?.reaction_count||0)*0.04 + (it?.reply_count||0)*0.04, 0.05), 0.95)*100);
  console.log(`до волны: p1(${f1?.reaction_count}💀) шанс=${ch(f1)}% | p2(${f2?.reaction_count}💀) шанс=${ch(f2)}%`);
  if (ch(f1) <= ch(f2)) { console.log('✗ ЧЕРЕПКИ НЕ ВЛИЯЮТ НА ШАНС'); return; }
  console.log('✓ черепки повышают шанс');

  console.log('запуск волны...');
  const reset = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }, cAdmin);
  console.log('reset:', JSON.stringify(reset).slice(0, 100));
  const feedAfter = await api('/api/feed?limit=20', {}, cA);
  const s1 = feedAfter.items.find(i => i.id === p1.id);
  const s2 = feedAfter.items.find(i => i.id === p2.id);
  console.log('после волны: p1 =', s1?.status, '| p2 =', s2?.status);
})();
