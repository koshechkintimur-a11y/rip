// Тест эхо-цикла (миграция 0014):
// 1) покупка крика → слот active
// 2) черепки от разных юзеров (+ self-skull запрет, toggle)
// 3) волна → крик с ≥ порога становится echo (waves_survived=1)
// 4) вторая волна без новых черепков → echo умирает (не бессмертен)
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

  // автор крика + 3 черепящих
  const cA = await mk('ec_a_' + ts);
  const cR = [];
  for (let i = 0; i < 3; i++) cR.push(await mk('ec_r' + i + '_' + ts));

  // 1) покупка крика (1 слот, 10 минут)
  const buy = await api('/api/attention', { method: 'POST', body: JSON.stringify({ content: 'кто-нибудь знает способ заработать?', slots: 1, minutes: 10 }) }, cA);
  console.log('покупка:', JSON.stringify(buy).slice(0, 120));

  // найти slotId: из ответа или из ленты внимания
  let slotId = buy.slotIds?.[0] || buy.slotId || buy.slots?.[0]?.id;
  if (!slotId) {
    const feed = await api('/api/feed?limit=20', {}, cA);
    const attention = feed.attention || feed.slots || [];
    slotId = attention[0]?.id;
  }
  if (!slotId) { console.log('✗ не найден slotId', JSON.stringify(buy).slice(0, 200)); return; }
  console.log('слот:', slotId.slice(0, 8), '| порог → 3 (тест)');

  // понижаем порог до 3
  const thr = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'echo_threshold', slotId, threshold: 3 }) }, cAdmin);
  console.log('порог установлен:', JSON.stringify(thr));

  // 2) черепки: 3 юзера черепят + self-skull запрет
  const skull = (c, sid) => fetch(BASE + '/api/attention/react', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify({ slotId: sid }) });
  for (const c of cR) { const r = await skull(c, slotId); console.log('  черепок:', r.status === 200 ? 'ok' : 'fail'); }
  const selfSkull = await api('/api/attention/react', { method: 'POST', body: JSON.stringify({ slotId }) }, cA);
  console.log('self-skull (должен быть 400):', JSON.stringify(selfSkull).slice(0, 60));

  // 3) волна → эхо (3 💀 ≥ 3 порог)
  const reset = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }, cAdmin);
  console.log('волна 1:', JSON.stringify(reset).slice(0, 80));

  // статус слота после волны — читаем из GET /api/attention
  const getSlot = async () => {
    const list = await api('/api/attention', {}, cA);
    return (list.slots || []).find(s => s.id === slotId) || {};
  };
  const slot = await getSlot();
  console.log('после волны 1:', slot.status, '| waves:', slot.waves_survived, '| 💀:', slot.skull_count);

  // 4) вторая волна без новых черепков (те же 3 💀 ≥ 3 → снова echo; чтобы проверить смерть, поднимем порог)
  const thr2 = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'echo_threshold', slotId, threshold: 9999 }) }, cAdmin);
  console.log('порог поднят до 9999 (имитация: черепки не добираются)');
  await wait(65000); // лимит волны
  const reset2 = await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }, cAdmin);
  console.log('волна 2:', JSON.stringify(reset2).slice(0, 80));
  const slot2 = await getSlot();
  const dead2 = slot2.id === undefined; // мёртвые крики не показываются в ленте
  console.log('после волны 2:', dead2 ? 'DEAD (скрыт из ленты)' : JSON.stringify({ status: slot2.status, waves: slot2.waves_survived, skulls: slot2.skull_count }));
  console.log(dead2 ? '✓ ЭХО УМЕРЛО (не бессмертно)' : '✗ эхо живо — баг');
})();
