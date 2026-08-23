/**
 * E2E smoke — полный пользовательский путь через API (production build).
 * Запуск: node scripts/e2e.mjs (сервер должен быть запущен: npm run start -- --port 3100)
 */
const BASE = process.env.E2E_BASE || 'http://localhost:3100';

let passed = 0, failed = 0;
function check(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const j = (o) => JSON.stringify(o);
const rnd = Math.random().toString(36).slice(2, 7);

async function main() {
  console.log('E2E smoke на', BASE);

  // 1. signup обоих
  const u1 = `e2e_a_${rnd}`;
  const u2 = `e2e_b_${rnd}`;
  const s1 = await api('/api/auth/signup', { method: 'POST', body: j({ email: `${u1}@rip.test`, password: 'test123', username: u1 }) });
  check('signup A', s1.status === 200, JSON.stringify(s1.data));
  const s2 = await api('/api/auth/signup', { method: 'POST', body: j({ email: `${u2}@rip.test`, password: 'test123', username: u2 }) });
  check('signup B', s2.status === 200, JSON.stringify(s2.data));

  async function login(email, password) {
    const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: j({ email, password }) });
    // Node 18+: заголовок может быть массивом
    const cookies = (typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || '']).join(';');
    const token = (cookies.match(/rip_session=([^;]+)/) || [])[1];
    return token;
  }
  const t1 = await login(`${u1}@rip.test`, 'test123');
  const t2 = await login(`${u2}@rip.test`, 'test123');
  check('login A+B', !!t1 && !!t2);

  const auth1 = { Authorization: '', Cookie: `rip_session=${t1}` };
  const auth2 = { Cookie: `rip_session=${t2}` };

  const call = (path, opts = {}) => api(path, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: auth1.Cookie, ...(opts.headers || {}) } });
  const call2 = (path, opts = {}) => api(path, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: auth2.Cookie, ...(opts.headers || {}) } });

  // 2. текст
  const m1 = await call('/api/messages', { method: 'POST', body: j({ content: 'текст от A' }) });
  check('post text', m1.status === 200, JSON.stringify(m1.data));

  // 3. картинка (относительный URL — ключевой баг ревьюера!)
  const m2 = await call('/api/messages', { method: 'POST', body: j({ content: 'картинка', mediaUrl: '/api/media/test.png', mediaType: 'image' }) });
  check('post image (relative URL)', m2.status === 200, JSON.stringify(m2.data));

  // 4. только картинка без текста
  const m3 = await call('/api/messages', { method: 'POST', body: j({ content: '', mediaUrl: '/api/media/only.png', mediaType: 'image' }) });
  check('post image only (no text)', m3.status === 200, JSON.stringify(m3.data));

  // 5. gif
  const m4 = await call('/api/messages', { method: 'POST', body: j({ content: 'гифка', mediaUrl: 'https://media.example/x.gif', mediaType: 'gif' }) });
  check('post gif (external URL)', m4.status === 200, JSON.stringify(m4.data));

  // 6. видео
  const m5 = await call('/api/messages', { method: 'POST', body: j({ content: 'видео', mediaUrl: '/api/media/v.mp4', mediaType: 'video' }) });
  check('post video', m5.status === 200, JSON.stringify(m5.data));

  // 7. ответ в ветку
  const rootId = m1.data?.message?.id;
  const reply = await call2('/api/messages', { method: 'POST', body: j({ content: 'ответ от B', parentMessageId: rootId }) });
  check('reply to message', reply.status === 200, JSON.stringify(reply.data));

  // 8. ветка читается
  if (rootId) {
    const branch = await call(`/api/messages/${rootId}`);
    check('branch has replies', branch.status === 200 && (branch.data?.replies?.length || 0) > 0, JSON.stringify(branch.data?.replies));
  }

  // 9. DM текст
  const meA = await call('/api/auth/me');
  const meB = await call2('/api/auth/me');
  const dm = await call('/api/dm', { method: 'POST', body: j({ recipientId: meB.data?.user?.id, content: 'привет в ЛС' }) });
  check('dm text', dm.status === 200, JSON.stringify(dm.data));

  // 10. DM с картинкой (только медиа!)
  const dm2 = await call('/api/dm', { method: 'POST', body: j({ recipientId: meB.data?.user?.id, content: '', mediaUrl: '/api/media/dm.png', mediaType: 'image' }) });
  check('dm image only', dm2.status === 200, JSON.stringify(dm2.data));

  // 11. attention purchase
  const attn = await call('/api/attention', { method: 'POST', body: j({ content: 'ЭФИР', slots: 1, minutes: 10 }) });
  check('attention purchase', attn.status === 200, JSON.stringify(attn.data));

  // 12. feed отдаёт всё
  const feed = await call('/api/feed?limit=20');
  const feedTypes = (feed.data?.items || []).filter(i => i.type === 'message').map(i => i.media_type);
  check('feed has media types', feed.status === 200 && feedTypes.length > 0, JSON.stringify(feedTypes));

  console.log(`\nИтог: ${passed} ✅ / ${failed} ❌`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('E2E упал:', e); process.exit(1); });
