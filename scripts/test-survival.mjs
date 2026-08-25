// Тест Survival Engine v1: юзер X черепит посты автора A →
// в персональной ленте (?personal=1) посты A должны быть выше постов B.
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
  const ts = Date.now().toString().slice(-5);
  const cX = await mk('sx_' + ts);   // читатель
  const cA = await mk('sa_' + ts);   // автор A (будет черипиться)
  const cB = await mk('sb_' + ts);   // автор B (не будет)
  console.log('юзеры: X(читатель), A(черепят), B(нет)');

  const post = async (c, content) => (await api('/api/messages', { method: 'POST', body: JSON.stringify({ content }) }, c)).message;
  // посты A и B, близкие по времени (уникальные тексты — тест можно перезапускать)
  const tag = 'sv' + ts;
  const a1 = await post(cA, 'персональный-тест-A-1-' + tag);
  const b1 = await post(cB, 'персональный-тест-B-1-' + tag);
  const a2 = await post(cA, 'персональный-тест-A-2-' + tag);
  const b2 = await post(cB, 'персональный-тест-B-2-' + tag);
  console.log('посты созданы: A×2, B×2');

  // X черепит оба поста A
  const skull = (id) => fetch(BASE + '/api/messages/react', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cX }, body: JSON.stringify({ messageId: id }) });
  await skull(a1.id);
  await skull(a2.id);
  console.log('X поставил 2 черепка постам A');

  // персональная лента X
  const feed = await api('/api/feed?personal=1&limit=10', {}, cX);
  console.log('engine:', feed.engine);
  const order = feed.items.map(i => i.content);
  console.log('порядок в персональной ленте:', JSON.stringify(order));

  const idxA1 = order.indexOf('персональный-тест-A-1-' + tag);
  const idxB1 = order.indexOf('персональный-тест-B-1-' + tag);
  const idxA2 = order.indexOf('персональный-тест-A-2-' + tag);
  const idxB2 = order.indexOf('персональный-тест-B-2-' + tag);

  const aAvg = (idxA1 >= 0 ? idxA1 : 99) + (idxA2 >= 0 ? idxA2 : 99);
  const bAvg = (idxB1 >= 0 ? idxB1 : 99) + (idxB2 >= 0 ? idxB2 : 99);
  console.log(`средняя позиция: A=${aAvg / 2} B=${bAvg / 2}`);
  console.log(aAvg < bAvg ? '✓ SURVIVAL ENGINE: посты автора, которому помогают жить, выше' : '✗ аффинити не влияет на выдачу');
})();
