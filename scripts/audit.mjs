/**
 * AUDIT — проход по всем API-роутам: статусы, ошибки, целостность ответов.
 * Запуск: node scripts/audit.mjs (сервер на 3002)
 */
const BASE = process.env.E2E_BASE || 'http://localhost:3002';
let passed = 0, failed = 0, issues = [];
function check(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; issues.push(`${name} ${extra}`); console.log(`  ❌ ${name} ${extra}`); }
}

const j = JSON.stringify;
async function api(path, opts = {}, cookie) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}), ...(cookie ? { Cookie: cookie } : {}) },
  });
  const data = await res.json().catch(() => null);
  const sc = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  return { status: res.status, data, cookie: sc.join(';') };
}

const rnd = Math.random().toString(36).slice(2, 6);
const email = `audit_${rnd}@x.ru`, email2 = `audit2_${rnd}@x.ru`;
const username = `audit_${rnd}`, username2 = `audit2_${rnd}`;

async function main() {
  console.log(`AUDIT API на ${BASE}\n`);

  // === AUTH ===
  console.log('— AUTH —');
  const s1 = await api('/api/auth/signup', { method: 'POST', body: j({ email, password: 'pass123', confirmPassword: 'pass123', username }) });
  check('signup', s1.status === 200, JSON.stringify(s1.data));
  const s2 = await api('/api/auth/signup', { method: 'POST', body: j({ email: email2, password: 'pass123', confirmPassword: 'pass123', username: username2 }) });
  check('signup 2', s2.status === 200, JSON.stringify(s2.data));
  const dup = await api('/api/auth/signup', { method: 'POST', body: j({ email: email, password: 'pass123', confirmPassword: 'pass123', username }) });
  check('signup дубль → 409', dup.status === 409, `status=${dup.status} ${JSON.stringify(dup.data)}`);
  const badPass = await api('/api/auth/signup', { method: 'POST', body: j({ email: `x_${rnd}@x.ru`, password: 'pass123', confirmPassword: 'pass456', username: `x_${rnd}` }) });
  check('signup пароли не совпадают → 400', badPass.status === 400, `status=${badPass.status}`);
  const checkU = await api('/api/auth/check-username?username=' + username);
  check('check-username занят', checkU.data?.taken === true, JSON.stringify(checkU.data));
  const login = await api('/api/auth/login', { method: 'POST', body: j({ email, password: 'pass123' }) });
  check('login', login.status === 200 && !!login.cookie, `status=${login.status}`);
  const c = login.cookie;
  const login2 = await api('/api/auth/login', { method: 'POST', body: j({ email: email2, password: 'pass123' }) });
  const c2 = login2.cookie;
  const me = await api('/api/auth/me', {}, c);
  check('me', me.status === 200 && me.data?.user?.username === username, JSON.stringify(me.data?.user));
  const wrongLogin = await api('/api/auth/login', { method: 'POST', body: j({ email, password: 'wrong!' }) });
  check('login неверный → 401', wrongLogin.status === 401, `status=${wrongLogin.status}`);

  // === PROFILE ===
  console.log('— PROFILE —');
  const otherProfile = await api('/api/profile/' + username2, {}, c);
  check('чужой профиль', otherProfile.status === 200 && otherProfile.data?.profile?.username === username2, JSON.stringify(otherProfile.data?.profile));
  check('чужой профиль: avatar_url в ответе', 'avatar_url' in (otherProfile.data?.profile || {}), JSON.stringify(otherProfile.data?.profile));
  const myProfile = await api('/api/profile', { method: 'PATCH', body: j({ bio: 'тестовая биография' }) }, c);
  check('update bio', myProfile.status === 200, JSON.stringify(myProfile.data));
  const upd = await api('/api/auth/update-profile', { method: 'PATCH', body: j({ username: username + '_v2' }) }, c);
  check('update username', upd.status === 200, JSON.stringify(upd.data));
  const updClash = await api('/api/auth/update-profile', { method: 'PATCH', body: j({ username: username2 }) }, c);
  check('update username занят → 409', updClash.status === 409, `status=${updClash.status}`);
  const changePass = await api('/api/auth/change-password', { method: 'PATCH', body: j({ currentPassword: 'pass123', newPassword: 'pass456' }) }, c);
  check('change password', changePass.status === 200, JSON.stringify(changePass.data));
  const changePassWrong = await api('/api/auth/change-password', { method: 'PATCH', body: j({ currentPassword: 'wrong!', newPassword: 'pass999' }) }, c);
  check('change password неверный текущий → 403', changePassWrong.status === 403, `status=${changePassWrong.status}`);
  const loginNew = await api('/api/auth/login', { method: 'POST', body: j({ email, password: 'pass456' }) });
  check('login после смены пароля', loginNew.status === 200, `status=${loginNew.status}`);
  const cN = loginNew.cookie;
  const forgot = await api('/api/auth/forgot', { method: 'POST', body: j({ email }) });
  check('forgot (devCode)', forgot.status === 200 && !!forgot.data?.devCode, JSON.stringify(forgot.data));
  if (forgot.data?.devCode) {
    const reset = await api('/api/auth/reset', { method: 'POST', body: j({ code: forgot.data.devCode, password: 'pass789' }) });
    check('reset по devCode', reset.status === 200, JSON.stringify(reset.data));
  }

  // === FEED / MESSAGES ===
  console.log('— FEED / MESSAGES —');
  const state = await api('/api/state', {}, cN);
  check('state', state.status === 200 && !!state.data?.season, JSON.stringify(state.data).slice(0, 120));
  const feed = await api('/api/feed?limit=10', {}, cN);
  check('feed', feed.status === 200 && Array.isArray(feed.data?.items), JSON.stringify(feed.data).slice(0, 100));
  const m1 = await api('/api/messages', { method: 'POST', body: j({ content: 'аудит-сообщение' }) }, cN);
  check('post message', m1.status === 200 && !!m1.data?.message?.id, JSON.stringify(m1.data));
  const msgId = m1.data?.message?.id;
  const empty = await api('/api/messages', { method: 'POST', body: j({ content: '', mediaUrl: null, mediaType: null }) }, cN);
  check('empty message → 400', empty.status === 400, `status=${empty.status}`);
  if (msgId) {
    const branch = await api('/api/messages/' + msgId, {}, cN);
    check('branch', branch.status === 200 && !!branch.data?.root, JSON.stringify(branch.data).slice(0, 100));
    const reply = await api('/api/messages', { method: 'POST', body: j({ content: 'ответ-аудит', parentMessageId: msgId }) }, cN);
    check('reply', reply.status === 200, JSON.stringify(reply.data));
    const branch2 = await api('/api/messages/' + msgId, {}, cN);
    check('branch содержит ответ', branch2.data?.replies?.length >= 1, JSON.stringify(branch2.data?.replies));
    const repost = await api('/api/messages', { method: 'PUT', body: j({ messageId: msgId }) }, cN);
    check('repost', repost.status === 200, JSON.stringify(repost.data));
  }
  const notif = await api('/api/notifications', {}, cN);
  check('notifications', notif.status === 200, JSON.stringify(notif.data).slice(0, 80));
  const seasons = await api('/api/seasons', {}, cN);
  check('seasons list', seasons.status === 200 && Array.isArray(seasons.data?.seasons), JSON.stringify(seasons.data).slice(0, 80));
  const att = await api('/api/attention', {}, cN);
  check('attention', att.status === 200, JSON.stringify(att.data).slice(0, 80));

  // === DM ===
  console.log('— DM —');
  const dmCreate = await api('/api/dm', { method: 'POST', body: j({ recipientId: (await api('/api/auth/me', {}, c2)).data?.user?.id }) }, cN);
  check('dm создать без сообщения', dmCreate.status === 200, JSON.stringify(dmCreate.data));
  const dmId = dmCreate.data?.conversationId;
  const dmText = await api('/api/dm', { method: 'POST', body: j({ recipientId: (await api('/api/auth/me', {}, c2)).data?.user?.id, content: 'привет аудит' }) }, cN);
  check('dm текст', dmText.status === 200, JSON.stringify(dmText.data));
  const dmMedia = await api('/api/dm', { method: 'POST', body: j({ recipientId: (await api('/api/auth/me', {}, c2)).data?.user?.id, content: '', mediaUrl: '/api/media/test.png', mediaType: 'image' }) }, cN);
  check('dm media-only', dmMedia.status === 200, JSON.stringify(dmMedia.data));
  const dmList = await api('/api/dm', {}, cN);
  check('dm список', dmList.status === 200 && Array.isArray(dmList.data?.conversations), JSON.stringify(dmList.data).slice(0, 100));
  if (dmId) {
    const dmMsgs = await api('/api/dm?conversationId=' + dmId, {}, cN);
    check('dm история', dmMsgs.status === 200, JSON.stringify(dmMsgs.data).slice(0, 80));
  }

  // === GIF / LINK ===
  console.log('— GIF / LINK —');
  const linkPrev = await api('/api/link-preview?url=https://github.com/koshechkintimur-a11y/rip', {}, cN);
  check('link-preview', linkPrev.status === 200, JSON.stringify(linkPrev.data).slice(0, 80));
  const linkBad = await api('/api/link-preview?url=http://localhost:3002/feed', {}, cN);
  check('link-preview SSRF → 400', linkBad.status === 400, `status=${linkBad.status}`);

  // === AUTH GUARDS ===
  console.log('— GUARDS —');
  const noAuth = await api('/api/feed', {});
  check('feed без авторизации → 401', noAuth.status === 401, `status=${noAuth.status}`);
  const noAuthState = await api('/api/state', {});
  check('state без авторизации → 401', noAuthState.status === 401, `status=${noAuthState.status}`);

  console.log(`\nИТОГ AUDIT: ${passed} ✅ / ${failed} ❌`);
  if (issues.length) console.log('Проблемы:\n  ' + issues.join('\n  '));
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error('AUDIT упал:', e); process.exit(1); });