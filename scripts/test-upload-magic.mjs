// Тест SEC-015: magic-bytes проверка upload
// 1) валидный PNG (настоящие байты) → 200
// 2) HTML, выданный за image/png → 400
// 3) PNG с file.type=text/html → 400
const BASE = 'http://localhost:3002';

(async () => {
  const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'timur@rip.demo', password: 'ripdemo123' }) });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

  // 1. настоящий PNG (1x1)
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001ffffffffc3d857a20000000049454e44ae426082', 'hex');
  const f1 = new FormData();
  f1.append('file', new Blob([png], { type: 'image/png' }), 'ok.png');
  const r1 = await fetch(BASE + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: f1 });
  console.log(`1. валидный PNG: ${r1.status} (200 = ок)`);

  // 2. HTML как image/png → должен быть 400
  const html = Buffer.from('<script>alert(1)</script>');
  const f2 = new FormData();
  f2.append('file', new Blob([html], { type: 'image/png' }), 'evil.png');
  const r2 = await fetch(BASE + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: f2 });
  console.log(`2. HTML как image/png: ${r2.status} (400 = защищено)`);

  // 3. PNG с file.type=text/html → должен быть 400
  const f3 = new FormData();
  f3.append('file', new Blob([png], { type: 'text/html' }), 'trick.png');
  const r3 = await fetch(BASE + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: f3 });
  console.log(`3. PNG как text/html: ${r3.status} (400 = защищено)`);
})();
