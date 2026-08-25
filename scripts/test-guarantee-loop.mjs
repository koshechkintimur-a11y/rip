// Честный тест гарантии «мир помнит»: 5 волн подряд, юзер с 5 постами без черепков.
// Без гарантии вероятность увидеть «все погибли» хотя бы раз за 5 волн ≈ 60%.
const BASE = 'http://localhost:3002';
const api = async (path, opts = {}, cookie) => {
  const r = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) } });
  return r.json();
};
const mk = async (u) => {
  const r = await fetch(BASE + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${u}@t.ru`, password: 'qa12345', confirmPassword: 'qa12345', username: u }) });
  return (r.headers.get('set-cookie') || '').split(';')[0];
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const adminLogin = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'timur@rip.demo', password: 'ripdemo123' }) });
  const cAdmin = (adminLogin.headers.get('set-cookie') || '').split(';')[0];

  const ts = Date.now().toString().slice(-5);
  const cU = await mk('gg_' + ts);
  const post = async (c, content) => (await api('/api/messages', { method: 'POST', body: JSON.stringify({ content }) }, c)).message;
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await post(cU, 'гарантия-' + ts + '-' + i)).id);
  console.log('5 постов создано, жду 65с (защита новых постов от первой волны)...');
  await wait(65000); // посты должны стать старше 60с, чтобы участвовать в волне

  let failures = 0;
  for (let w = 1; w <= 5; w++) {
    let reset = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }, cAdmin);
    while (reset.error) { await wait(65000); reset = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }, cAdmin); }
    const me = await api('/api/me', {}, cU);
    const alive = me.messages.filter(m => ids.includes(m.id) && m.status !== 'dead').length;
    const dead = me.messages.filter(m => ids.includes(m.id) && m.status === 'dead').length;
    console.log(`волна ${w}: живы=${alive} погибли=${dead}`);
    if (alive === 0) failures++;
    if (w < 5) await wait(65000); // между волнами — лимит 60с
  }
  console.log(failures === 0 ? '✓ ГАРАНТИЯ: ни разу «все погибли» за 5 волн' : `✗ ПРОВАЛ: ${failures} раз все погибли`);
})();
